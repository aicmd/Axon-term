import React from 'react';
import { Server, LogOut, ArrowRightLeft, ChevronDown, AlertCircle, ArrowLeft } from 'lucide-react';
import { useI18n } from '../../I18nContext';
import { useHosts } from '../../HostContext';
import { SftpEntry, Host } from '../../types';
import { FilePane } from './FilePane';

interface RemotePanelProps {
  activeHostId: string | null;
  host: Host | undefined;
  path: string;
  files: SftpEntry[];
  selectedFile: SftpEntry | null;
  isLoading: boolean;
  error: string | null;
  onSelect: (file: SftpEntry | null) => void;
  onFileDrop: (file: SftpEntry, sourcePaneId: string) => void;
  onNavigate: (newPath: string) => void;
  onRefresh: () => void;
  onGoHome: () => void;
  onDelete: (file: SftpEntry) => void;
  onDisconnect: () => void;
  onSelectHost: (hostId: string) => void;
}

export const RemotePanel: React.FC<RemotePanelProps> = ({
  activeHostId, host, path, files, selectedFile, isLoading, error,
  onSelect, onFileDrop, onNavigate, onRefresh, onGoHome, onDelete,
  onDisconnect, onSelectHost
}) => {
  const { t } = useI18n();
  const { hosts } = useHosts();
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredHosts = hosts.filter(h =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!activeHostId) {
    return (
      <div className="flex-1 flex flex-col bg-sidebar animate-in fade-in duration-500">
        <div className="flex items-center px-4 py-2 border-b border-border bg-sidebar h-10">
          <div className="flex items-center gap-2 text-sm font-medium text-textMain">
            <Server size={16} className="text-textMuted" />
            <span>{t('selectRemoteHost')}</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center p-4 gap-4 overflow-hidden">
          {/* Compact Fixed Header section */}
          <div className="flex flex-col items-center gap-3 shrink-0 w-full max-w-sm animate-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-4 w-full">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                <ArrowRightLeft size={24} />
              </div>
              <div className="text-left min-w-0">
                <h3 className="text-sm font-bold text-textMain truncate">{t('noHostConnected')}</h3>
                <p className="text-[11px] text-textMuted truncate">{t('selectHostPrompt')}</p>
              </div>
            </div>

            {/* Compact Search Input */}
            <div className="w-full">
              <input
                type="text"
                autoFocus
                placeholder={t('searchHosts') || 'Search hosts...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-main border border-border rounded-lg px-3 py-2 text-xs text-textMain placeholder:text-textMuted focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/40 transition-all"
              />
            </div>
          </div>

          {/* Scrollable List section with fade mask */}
          <div
            className="w-full max-w-sm flex-1 overflow-y-auto pr-2 custom-scrollbar"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent, black 5%, black 95%, transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 5%, black 95%, transparent)'
            }}
          >
            <div className="grid gap-2 pb-8">
              {filteredHosts.map(h => (
                <button
                  key={h.id}
                  onClick={() => onSelectHost(h.id)}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-main hover:border-accent hover:bg-accent/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-hover flex items-center justify-center text-textMuted group-hover:text-accent transition-colors">
                      <Server size={16} />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-textMain">{h.name}</div>
                      <div className="text-[10px] text-textMuted">{h.username}@{h.address}</div>
                    </div>
                  </div>
                  <ChevronDown size={14} className="-rotate-90 text-textMuted group-hover:text-accent" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Connection loading state
  if (isLoading && !path) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-sidebar animate-in fade-in duration-500">
        <div className="flex flex-col items-center gap-6 animate-in zoom-in-95 duration-500">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
            <Server className="absolute inset-0 m-auto text-accent animate-pulse" size={32} />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-textMain tracking-tight">{t('connecting')}...</h3>
            <p className="text-sm text-textMuted mt-1">{host?.name} ({host?.address})</p>
          </div>
        </div>
      </div>
    );
  }

  // Connection error state
  if (error && !path) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-sidebar animate-in zoom-in-95 duration-300">
        <div className="max-w-md w-4/5 bg-main border border-error/20 rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-6 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-error/20" />
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center text-error group-hover:scale-110 transition-transform duration-500">
            <AlertCircle size={32} />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-textMain">{t('connectionFailed')}</h3>
            <div className="max-h-32 overflow-y-auto px-2 custom-scrollbar">
              <p className="text-xs text-error leading-relaxed break-all font-mono opacity-80">{error}</p>
            </div>
          </div>
          <button
            onClick={onDisconnect}
            className="flex items-center gap-2 px-6 py-2.5 bg-accent text-main rounded-xl hover:bg-accent/90 hover:scale-105 active:scale-95 transition-all font-bold shadow-lg shadow-accent/20"
          >
            <ArrowLeft size={18} />
            {t('backToHostList')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <FilePane
      paneId="remote"
      title={host?.name || 'Remote'}
      icon={<Server size={16} className="text-success" />}
      path={path}
      files={files}
      selectedFile={selectedFile}
      onSelect={onSelect}
      onFileDrop={onFileDrop}
      onNavigate={onNavigate}
      onRefresh={onRefresh}
      onGoHome={onGoHome}
      onDelete={onDelete}
      isLoading={isLoading}
      menuActions={[
        {
          label: t('disconnect'),
          icon: <LogOut size={14} />,
          onClick: onDisconnect,
          danger: true
        }
      ]}
    />
  );
};
