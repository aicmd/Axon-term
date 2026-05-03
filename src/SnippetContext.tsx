import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Snippet } from './types';
import { invoke } from '@tauri-apps/api/core';

import { useSettings } from './SettingsContext';

const MAX_HISTORY_ITEMS = 1000;

const mergeHistoryItems = (prev: HistoryItem[], next: HistoryItem[]): HistoryItem[] => {
  const seenCommands = new Set<string>();
  const merged: HistoryItem[] = [];

  // Prioritize existing items (which might be more recent or manual)
  prev.forEach(item => {
    const key = `${item.hostId || 'local'}:${item.command}`;
    if (!seenCommands.has(key)) {
      merged.push(item);
      seenCommands.add(key);
    }
  });

  // Add new items if not already seen
  next.forEach(item => {
    const key = `${item.hostId || 'local'}:${item.command}`;
    if (!seenCommands.has(key)) {
      merged.push(item);
      seenCommands.add(key);
    }
  });

  return merged.slice(0, MAX_HISTORY_ITEMS);
};

export interface HistoryItem {
  id: string;
  command: string;
  timestamp: number;
  type: 'snippet' | 'manual' | 'system';
  name?: string;
  hostId?: string; // Optional: associate with a specific host or 'local'
}

interface SnippetContextType {
  snippets: Snippet[];
  history: HistoryItem[];
  addSnippet: (snippet: Omit<Snippet, 'id'>) => void;
  updateSnippet: (id: string, snippet: Partial<Snippet>) => void;
  deleteSnippet: (id: string) => void;
  runSnippet: (command: string, tabId?: string, name?: string, hostId?: string) => void;
  addToHistory: (command: string, name?: string, hostId?: string, isSystem?: boolean) => void;
  clearHistory: () => void;
  syncLocalHistory: () => Promise<void>;
  syncRemoteHistory: (hostId: string) => Promise<void>;
}

const SnippetContext = createContext<SnippetContextType | undefined>(undefined);

export const SnippetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSettings();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Initialize from localStorage and System Shell History
  useEffect(() => {
    const initData = async () => {
      // Load snippets from backend
      try {
        const backendSnippets = await invoke<Snippet[]>('get_snippets');
        setSnippets(backendSnippets);
      } catch (err) {
        console.error("Failed to load snippets from backend", err);
        // Fallback to empty if error
        setSnippets([]);
      }

      // Load session history
      let sessionHistory: HistoryItem[] = [];
      const savedHistory = localStorage.getItem('axon-history');
      if (savedHistory) sessionHistory = JSON.parse(savedHistory);
      setHistory(sessionHistory);
    };

    initData();
  }, []); // Only on mount

  const localSynced = React.useRef(false);

  const syncLocalHistory = useCallback(async () => {
    if (localSynced.current || !settings.importShellHistory) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      interface ParsedHistoryItem { command: string; timestamp: number | null; }
      const systemHistoryItems = await invoke<ParsedHistoryItem[]>('get_shell_history');
      
      const systemHistory: HistoryItem[] = systemHistoryItems.map((item, index) => ({
        id: `sys_${index}_${Date.now()}`,
        command: item.command,
        timestamp: item.timestamp ? item.timestamp * 1000 : Date.now() - (index * 1000),
        type: 'system',
        hostId: 'local'
      }));

      setHistory(prev => mergeHistoryItems(prev, systemHistory));
      localSynced.current = true;
    } catch (e) {
      console.error("Failed to fetch local history", e);
    }
  }, [settings.importShellHistory]);

  const filteredHistory = React.useMemo(() => {
    if (settings.importShellHistory) return history;
    return history.filter(h => h.type !== 'system');
  }, [history, settings.importShellHistory]);

  // Persist history
  useEffect(() => {
    // Only persist manual/snippet items, not system items (system items are re-fetched)
    const toSave = history.filter(h => h.type !== 'system');
    localStorage.setItem('axon-history', JSON.stringify(toSave));
  }, [history]);

  // Persist snippets to backend
  const initialLoadRef = React.useRef(true);
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    invoke('save_snippets', { snippets }).catch(err => {
      console.error("Failed to save snippets to backend", err);
    });
  }, [snippets]);

  const addSnippet = useCallback((newSnippet: Omit<Snippet, 'id'>) => {
    const snippet: Snippet = {
      ...newSnippet,
      id: `snippet_${Date.now()}`,
    };
    setSnippets(prev => [snippet, ...prev]);
  }, []);

  const updateSnippet = useCallback((id: string, updates: Partial<Snippet>) => {
    setSnippets(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const deleteSnippet = useCallback((id: string) => {
    setSnippets(prev => prev.filter(s => s.id !== id));
  }, []);

  const addToHistory = useCallback((command: string, name?: string, hostId?: string, isSystem: boolean = false) => {
    if (!command || !command.trim()) return;
    
    const historyItem: HistoryItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      command: command.trim(),
      timestamp: Date.now(),
      type: isSystem ? 'system' : (name ? 'snippet' : 'manual'),
      name,
      hostId: hostId || 'local'
    };
    
    setHistory(prev => {
      // De-duplicate same command on same host
      const key = `${hostId || 'local'}:${command.trim()}`;
      const filtered = prev.filter(item => `${item.hostId || 'local'}:${item.command}` !== key).slice(0, MAX_HISTORY_ITEMS - 1);
      return [historyItem, ...filtered];
    });
  }, []);

  const runSnippet = useCallback((command: string, tabId?: string, name?: string, hostId?: string) => {
    const fullCommand = command.endsWith('\r') ? command : command + '\r';
    window.dispatchEvent(new CustomEvent('axon-run-snippet', {
      detail: { command: fullCommand, tabId }
    }));
    
    addToHistory(command, name, hostId);
  }, [addToHistory]);

  const clearHistory = useCallback(() => {
    setHistory(prev => prev.filter(h => h.type === 'system')); // Keep system history but clear session ones
  }, []);

  const syncedHosts = React.useRef<Set<string>>(new Set());

  const syncRemoteHistory = useCallback(async (hostId: string) => {
    if (syncedHosts.current.has(hostId) || !settings.importShellHistory) return;
    
    try {
      syncedHosts.current.add(hostId);
      const { invoke } = await import("@tauri-apps/api/core");
      interface ParsedHistoryItem { command: string; timestamp: number | null; }
      const remoteHistoryItems = await invoke<ParsedHistoryItem[]>('get_remote_shell_history', { id: hostId });
      
      if (remoteHistoryItems && remoteHistoryItems.length > 0) {
        setHistory(prev => {
          const newItems: HistoryItem[] = remoteHistoryItems.map((item, index) => ({
            id: `sys_rem_${hostId}_${index}_${Date.now()}`,
            command: item.command,
            timestamp: item.timestamp ? item.timestamp * 1000 : Date.now() - (index * 1000),
            type: 'system',
            hostId
          }));

          return mergeHistoryItems(prev, newItems);
        });
      }
    } catch (err) {
      console.error(`Failed to fetch remote history for ${hostId}:`, err);
      // Remove from synced hosts on failure so it can be retried
      syncedHosts.current.delete(hostId);
    }
  }, [settings.importShellHistory]);

  return (
    <SnippetContext.Provider value={{ snippets, history: filteredHistory, addSnippet, updateSnippet, deleteSnippet, runSnippet, addToHistory, clearHistory, syncLocalHistory, syncRemoteHistory }}>
      {children}
    </SnippetContext.Provider>
  );
};

export const useSnippets = () => {
  const context = useContext(SnippetContext);
  if (!context) throw new Error('useSnippets must be used within a SnippetProvider');
  return context;
};
