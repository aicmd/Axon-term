import { ConnectionState } from "../../types";

export interface OpenTerminalResponse {
  sessionId: string;
  status: string;
  kind: string;
}

export interface TerminalOutputEvent {
  sessionId: string;
  data: string;
}

export interface SessionStateEvent {
  sessionId: string;
  status: string;
  message?: string;
}

export interface TerminalPaneHandle {
  sendRawData: (data: string) => void;
  focus: () => void;
}

export interface TerminalPaneProps {
  id: string;
  hostId: string;
  tabId?: string;
  onClose?: (id: string) => void;
  isFocused: boolean;
  onClick: (id: string) => void;
  onStatusChange?: (state: ConnectionState) => void;
}
