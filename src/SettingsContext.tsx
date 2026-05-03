import React, { createContext, useContext, useState, useEffect } from 'react';

export type AutocompleteType = 'helium' | 'hydrogen' | 'disabled';
export type TerminalEmulationType = 'xterm-256color' | 'xterm-16color' | 'xterm';
export type CursorStyleType = 'block' | 'underline' | 'bar';
export type SecretStorageType = 'file' | 'keychain';

interface Settings {
  autocomplete: AutocompleteType;
  autoReconnect: boolean;
  importShellHistory: boolean;
  showServerMetrics: boolean;
  showSessionInfo: boolean;
  isRightSidebarOpen: boolean;
  terminalEmulation: TerminalEmulationType;
  fontFamily: string;
  fontSize: number;
  scrollback: number;
  cursorStyle: CursorStyleType;
  secretStorage: SecretStorageType;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const DEFAULT_SETTINGS: Settings = {
  autocomplete: 'helium',
  autoReconnect: true,
  importShellHistory: true,
  showServerMetrics: true,
  showSessionInfo: true,
  isRightSidebarOpen: true,
  terminalEmulation: 'xterm-256color',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 14,
  scrollback: 5000,
  cursorStyle: 'block',
  secretStorage: 'file',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('axon-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('axon-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
