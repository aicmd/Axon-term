import { SftpEntry } from '../../types';

export interface FilePaneProps {
  paneId: 'local' | 'remote';
  title: string;
  icon: React.ReactNode;
  path: string;
  files: SftpEntry[];
  selectedFile: SftpEntry | null;
  onSelect: (file: SftpEntry | null) => void;
  onFileDrop: (file: SftpEntry, sourcePaneId: string) => void;
  onNavigate: (newPath: string) => void;
  onRefresh: () => void;
  onGoHome: () => void;
  onDelete: (file: SftpEntry) => void;
  menuActions?: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[];
  isLoading?: boolean;
}

export interface TransferItem {
  name: string;
  progress: number;
  type: 'upload' | 'download';
}

export interface TransferStats {
  uploads: number;
  downloads: number;
}

export interface TransferProgressPayload {
  filename: string;
  transferred: number;
  total: number;
}

export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// Module-level drag payload: bypasses WebKit's broken dataTransfer.getData()
// which returns an empty string in drop events on macOS / Tauri.
export let activeDragPayload: { file: SftpEntry; sourcePaneId: string } | null = null;
export function setActiveDragPayload(payload: typeof activeDragPayload) {
  activeDragPayload = payload;
}
