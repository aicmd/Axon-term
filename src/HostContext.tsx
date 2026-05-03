import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Host, CreateHostInput, ConnectionState } from './types';

interface HostStateChangedPayload {
  host_id: string;
  state: ConnectionState;
}

interface HostContextType {
  hosts: Host[];
  addHost: (input: CreateHostInput) => Promise<Host>;
  updateHost: (id: string, input: CreateHostInput) => Promise<Host>;
  deleteHost: (id: string) => Promise<void>;
  getHost: (id: string) => Host | undefined;
  refreshHosts: () => Promise<void>;
}

const HostContext = createContext<HostContextType | undefined>(undefined);

/**
 * HostProvider manages the lifecycle and state of remote hosts.
 */
export const HostProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [hosts, setHosts] = useState<Host[]>([]);

  /**
   * Load hosts from backend (Tauri).
   */
  const refreshHosts = useCallback(async () => {
    try {
      const fetchedHosts = await invoke<Host[]>('list_hosts');
      setHosts(fetchedHosts);
    } catch (err) {
      console.error('[HostContext] Failed to load hosts from backend:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshHosts();
  }, [refreshHosts]);

  // Listen for host state changes (e.g. connection status)
  useEffect(() => {
    let unlistenFn: UnlistenFn | undefined;
    let isMounted = true;
    const setupListener = async () => {
      const unlisten = await listen<HostStateChangedPayload>('host-state-changed', (event) => {
        const { host_id, state } = event.payload;
        setHosts(prev => prev.map(h => h.id === host_id ? { ...h, state } : h));
      });
      if (!isMounted) unlisten();
      else unlistenFn = unlisten;
    };
    setupListener();
    return () => {
      isMounted = false;
      if (unlistenFn) unlistenFn();
    };
  }, []);

  // Listen for external host changes
  useEffect(() => {
    let unlistenFn: UnlistenFn | undefined;
    let isMounted = true;
    const setupListener = async () => {
      const unlisten = await listen('hosts-changed', () => {
        refreshHosts();
      });
      if (!isMounted) unlisten();
      else unlistenFn = unlisten;
    };
    setupListener();
    return () => {
      isMounted = false;
      if (unlistenFn) unlistenFn();
    };
  }, [refreshHosts]);

  const addHost = useCallback(async (input: CreateHostInput) => {
    try {
      const newHost = await invoke<Host>('create_host', { input });
      setHosts(prev => [...prev, newHost]);
      return newHost;
    } catch (err) {
      console.error('[HostContext] Failed to create host:', err);
      throw new Error('Failed to create host');
    }
  }, []);

  const updateHost = useCallback(async (id: string, input: CreateHostInput) => {
    try {
      const updatedHost = await invoke<Host>('update_host', { id, input });
      setHosts(prev => prev.map(h => h.id === id ? updatedHost : h));
      return updatedHost;
    } catch (err) {
      console.error('[HostContext] Failed to update host:', err);
      throw new Error('Failed to update host');
    }
  }, []);

  const deleteHost = useCallback(async (id: string) => {
    try {
      await invoke('delete_host', { id });
      setHosts(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      console.error('[HostContext] Failed to delete host:', err);
      throw new Error('Failed to delete host');
    }
  }, []);

  const getHost = useCallback((id: string) => {
    return hosts.find(h => h.id === id);
  }, [hosts]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(() => ({
    hosts,
    addHost,
    updateHost,
    deleteHost,
    getHost,
    refreshHosts
  }), [hosts, addHost, updateHost, deleteHost, getHost, refreshHosts]);

  return (
    <HostContext.Provider value={contextValue}>
      {children}
    </HostContext.Provider>
  );
};

export const useHosts = () => {
  const context = useContext(HostContext);
  if (context === undefined) {
    throw new Error('useHosts must be used within a HostProvider');
  }
  return context;
};
