export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  TERMINAL = 'TERMINAL',
  SFTP = 'SFTP',
  SETTINGS = 'SETTINGS',
  HOST_LIST = 'HOST_LIST',
  SNIPPETS = 'SNIPPETS'
}

export interface PortForward {
  localPort: number;
  remoteAddress: string;
  remotePort: number;
}

/**
 * Host configuration — aligned with backend domain::host::Host.
 * Uses `address` instead of `ip` to match Rust struct.
 */
export interface Host {
  id: string;
  name: string;
  address: string;
  port: number;
  username: string;
  authType: 'password' | 'key' | string;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  group?: string;
  os?: string;
  portForwards?: PortForward[];
  state?: ConnectionState;
}

export type CreateHostInput = Omit<Host, 'id'>;

export interface Tab {
  id: string;
  hostId: string;
  title: string;
  viewMode: ViewMode;
  startTime: number;
  state: ConnectionState;
}

export interface SftpEntry {
  path: string;
  name: string;
  kind: 'file' | 'directory' | 'symlink' | string;
  size: number;
}

export interface ListSftpEntriesResponse {
  currentPath: string;
  entries: SftpEntry[];
}

export interface Snippet {
  id: string;
  name: string;
  command: string;
  description?: string;
  category?: string;
}
