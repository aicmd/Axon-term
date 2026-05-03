import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Download } from 'lucide-react';
import { useI18n } from '../I18nContext';
import { useHosts } from '../HostContext';
import { SftpEntry, ListSftpEntriesResponse } from '../types';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { TransferItem, TransferStats, TransferProgressPayload } from './sftp/types';
import { LocalPanel } from './sftp/LocalPanel';
import { RemotePanel } from './sftp/RemotePanel';
import { TransferQueue } from './sftp/TransferQueue';
import { DeleteConfirmModal } from './sftp/DeleteConfirmModal';

export const SftpView: React.FC<{
  hostId: string,
  onTitleChange?: (title: string) => void,
  onHostChange?: (hostId: string) => void
}> = ({ hostId: initialHostId, onTitleChange, onHostChange }) => {
  const { t } = useI18n();
  const { getHost, refreshHosts } = useHosts();
  const [activeHostId, setActiveHostId] = useState<string | null>(initialHostId);
  const host = activeHostId ? getHost(activeHostId) : null;

  useEffect(() => {
    if (onHostChange) {
      onHostChange(activeHostId || '');
    }
    if (activeHostId) {
      refreshHosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHostId]);

  useEffect(() => {
    if (onTitleChange) {
      if (host) {
        onTitleChange(host.name);
      } else if (!activeHostId) {
        onTitleChange(t('sftp'));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host?.name, activeHostId, t]);

  const [localFiles, setLocalFiles] = useState<SftpEntry[]>([]);
  const [remoteFiles, setRemoteFiles] = useState<SftpEntry[]>([]);
  const [localPath, setLocalPath] = useState<string>('');
  const [remotePath, setRemotePath] = useState<string>('');
  const [selectedLocal, setSelectedLocal] = useState<SftpEntry | null>(null);
  const [selectedRemote, setSelectedRemote] = useState<SftpEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingRemote, setIsLoadingRemote] = useState(!!initialHostId);

  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [stats, setStats] = useState<TransferStats>({ uploads: 0, downloads: 0 });
  const processedFiles = useRef<Set<string>>(new Set());

  // Use refs to keep track of current paths in callbacks without stale closures
  const currentLocalPath = useRef('');
  const currentRemotePath = useRef('');

  const [confirmDelete, setConfirmDelete] = useState<{ file: SftpEntry, paneId: 'local' | 'remote' } | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────

  const fetchLocal = useCallback(async (path?: string) => {
    try {
      const res = await invoke<ListSftpEntriesResponse>('list_local_entries', { path: path || null });
      setLocalPath(res.currentPath);
      currentLocalPath.current = res.currentPath;
      setLocalFiles(res.entries);
      setSelectedLocal(null);
      setError(null);
    } catch (err: any) {
      console.error('Failed to list local entries:', err);
      setError(`Local error: ${err}`);
    }
  }, []);

  const fetchRemote = useCallback(async (path?: string) => {
    if (!activeHostId || activeHostId === 'local') {
      setRemoteFiles([]);
      setRemotePath('');
      return;
    }
    setIsLoadingRemote(true);
    try {
      const res = await invoke<ListSftpEntriesResponse>('list_entries', { hostId: activeHostId, path: path || null });
      setRemotePath(res.currentPath);
      currentRemotePath.current = res.currentPath;
      setRemoteFiles(res.entries);
      setSelectedRemote(null);
      setError(null);
    } catch (err: any) {
      console.error('Failed to list remote entries:', err);
      setError(`Remote error: ${err}`);
    } finally {
      setIsLoadingRemote(false);
    }
  }, [activeHostId]);

  useEffect(() => {
    // Small delay to ensure the component shell renders first and tab switch feels instant
    const timer = setTimeout(() => {
      fetchLocal();
    }, 50);
    return () => clearTimeout(timer);
  }, [fetchLocal]);

  useEffect(() => {
    // Small delay to ensure the component shell renders first and tab switch feels instant
    const timer = setTimeout(() => {
      if (activeHostId) {
        fetchRemote();
      } else {
        setRemoteFiles([]);
        setRemotePath('');
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeHostId, fetchRemote]);

  // ── File transfer ──────────────────────────────────────────────────

  const handleFileTransfer = useCallback(async (file: SftpEntry, sourcePaneId: string) => {
    if (!activeHostId) return;
    try {
      if (sourcePaneId === 'local') {
        if (file.kind === 'directory') {
          setError("Directory upload not supported yet");
          return;
        }
        setTransfers(prev => [{ name: file.name, progress: 0, type: 'upload' }, ...prev]);
        await invoke('upload_file', { hostId: activeHostId, localSource: file.path, remoteDirectory: currentRemotePath.current });
      } else {
        if (file.kind === 'directory') {
          setError("Directory download not supported yet");
          return;
        }
        setTransfers(prev => [{ name: file.name, progress: 0, type: 'download' }, ...prev]);
        await invoke('download_file', { hostId: activeHostId, remotePath: file.path, localTarget: currentLocalPath.current });
      }
    } catch (err: any) {
      console.error('File transfer failed:', err);
      setError(`Transfer error: ${err}`);
      setTransfers(prev => prev.filter(tr => tr.name !== file.name));
    }
  }, [activeHostId]);

  // ── Delete ─────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (file: SftpEntry, paneId: 'local' | 'remote') => {
    try {
      if (paneId === 'local') {
        await invoke('delete_local_entry', { path: file.path });
        fetchLocal(currentLocalPath.current);
      } else {
        if (!activeHostId) return;
        await invoke('delete_remote_entry', { hostId: activeHostId, path: file.path });
        fetchRemote(currentRemotePath.current);
      }
      setConfirmDelete(null);
    } catch (err: any) {
      console.error('Delete failed:', err);
      setError(`Delete error: ${err}`);
      setConfirmDelete(null);
    }
  }, [activeHostId, fetchLocal, fetchRemote]);

  // ── Transfer progress listener ─────────────────────────────────────

  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    let isMounted = true;

    const setupListener = async () => {
      const unlisten = await listen<TransferProgressPayload>('transfer-progress', (event) => {
        const { filename, transferred, total } = event.payload;
        const progress = total > 0 ? (transferred / total) * 100 : 0;

        setTransfers(prev => {
          const existing = prev.find(tr => tr.name === filename);
          if (!existing) return prev;

          const justFinished = progress >= 100 && !processedFiles.current.has(filename);

          if (justFinished) {
            processedFiles.current.add(filename);

            setStats(s => ({
              ...s,
              uploads: existing.type === 'upload' ? s.uploads + 1 : s.uploads,
              downloads: existing.type === 'download' ? s.downloads + 1 : s.downloads
            }));

            setTimeout(() => {
              setTransfers(current => current.filter(tr => tr.name !== filename));
              processedFiles.current.delete(filename);
              fetchLocal(currentLocalPath.current);
              if (activeHostId) fetchRemote(currentRemotePath.current);
            }, 1000);
          }

          return prev.map(tr => tr.name === filename ? { ...tr, progress } : tr);
        });
      });

      if (!isMounted) {
        unlisten();
      } else {
        unlistenFn = unlisten;
      }
    };

    setupListener();
    return () => {
      isMounted = false;
      if (unlistenFn) unlistenFn();
    };
  }, [activeHostId, fetchLocal, fetchRemote]);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full bg-main">
    <div className="flex-1 flex overflow-hidden p-[1px]">
        <LocalPanel
          path={localPath}
          files={localFiles}
          selectedFile={selectedLocal}
          onSelect={setSelectedLocal}
          onFileDrop={handleFileTransfer}
          onNavigate={fetchLocal}
          onRefresh={() => fetchLocal(localPath)}
          onGoHome={() => fetchLocal()}
          onDelete={(file) => setConfirmDelete({ file, paneId: 'local' })}
        />

        {/* Center action bar */}
        <div className="w-12 bg-sidebar border-x border-border flex flex-col items-center justify-center gap-4 z-10 shadow-inner">
          <button
            disabled={!selectedLocal || selectedLocal.kind === 'directory' || !activeHostId}
            onClick={() => selectedLocal && handleFileTransfer(selectedLocal, 'local')}
            className={`p-2 rounded-full transition-all shadow-lg group relative ${!selectedLocal || selectedLocal.kind === 'directory' || !activeHostId ? 'bg-hover text-textMuted opacity-50 cursor-not-allowed' : 'bg-accent text-main hover:scale-110 active:scale-95'}`}
          >
            <Upload size={16} />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-main text-textMain text-[10px] rounded border border-border opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-xl">
              {t('upload')}
            </span>
          </button>
          <button
            disabled={!selectedRemote || selectedRemote.kind === 'directory' || !activeHostId || !!error || !remotePath}
            onClick={() => selectedRemote && handleFileTransfer(selectedRemote, 'remote')}
            className={`p-2 rounded-full transition-all shadow-lg group relative ${!selectedRemote || selectedRemote.kind === 'directory' || !activeHostId || !!error || !remotePath ? 'bg-hover text-textMuted opacity-50 cursor-not-allowed' : 'bg-success text-main hover:scale-110 active:scale-95'}`}
          >
            <Download size={16} />
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-main text-textMain text-[10px] rounded border border-border opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-xl">
              {t('download')}
            </span>
          </button>
        </div>

        <RemotePanel
          activeHostId={activeHostId}
          host={host ?? undefined}
          path={remotePath}
          files={remoteFiles}
          selectedFile={selectedRemote}
          isLoading={isLoadingRemote}
          error={error}
          onSelect={setSelectedRemote}
          onFileDrop={handleFileTransfer}
          onNavigate={fetchRemote}
          onRefresh={() => fetchRemote(remotePath)}
          onGoHome={() => fetchRemote()}
          onDelete={(file) => setConfirmDelete({ file, paneId: 'remote' })}
          onDisconnect={() => {
            setActiveHostId(null);
            setSelectedRemote(null);
            setRemoteFiles([]);
            setRemotePath('');
            setError(null);
          }}
          onSelectHost={(id) => {
            setError(null);
            setSelectedRemote(null);
            setRemoteFiles([]);
            setRemotePath('');
            setIsLoadingRemote(true);
            setActiveHostId(id);
          }}
        />
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <DeleteConfirmModal
          file={confirmDelete.file}
          paneId={confirmDelete.paneId}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <TransferQueue transfers={transfers} stats={stats} />
    </div>
  );
};