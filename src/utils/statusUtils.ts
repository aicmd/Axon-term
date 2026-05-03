import { ConnectionState } from '../types';

/**
 * Returns the Tailwind CSS classes for the connection status dot.
 * 
 * @param state - The current connection state of the host
 * @param hasTab - Whether a tab is currently open for this host
 * @returns A string of Tailwind CSS classes
 */
export const getStatusColor = (state: ConnectionState, hasTab: boolean): string => {
  // Warning state: Tab is open but host is disconnected
  if (hasTab && state === ConnectionState.DISCONNECTED) {
    return 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]';
  }

  const colors = {
    [ConnectionState.CONNECTED]: 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]',
    [ConnectionState.CONNECTING]: 'bg-accent animate-pulse',
    [ConnectionState.ERROR]: 'bg-error shadow-[0_0_8px_rgba(239,68,68,0.4)]',
    [ConnectionState.DISCONNECTED]: 'bg-textMuted/30',
  };

  return colors[state] || 'bg-textMuted/20';
};
