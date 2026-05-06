import React from 'react';
import { ViewMode, Tab, Host, ConnectionState } from '../../types';
import { TerminalView } from '../TerminalView';

const SftpView = React.lazy(() => import('../SftpView').then(m => ({ default: m.SftpView })));
const HostListView = React.lazy(() => import('../HostListView').then(m => ({ default: m.HostListView })));
const SnippetListView = React.lazy(() => import('../SnippetListView').then(m => ({ default: m.SnippetListView })));
const SettingsView = React.lazy(() => import('../SettingsView').then(m => ({ default: m.SettingsView })));

const ViewLoading: React.FC = () => (
  <div className="flex-1 flex items-center justify-center bg-main animate-in fade-in duration-500">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin"></div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-textMuted animate-pulse">Loading View...</div>
    </div>
  </div>
);

interface ViewContainerProps {
  activeTabId: string | null;
  activeGlobalView: ViewMode;
  tabs: Tab[];
  hosts: Host[];
  openSession: (hostOrId: string | Host | null, mode: ViewMode) => void;
  handleAddHost: () => void;
  handleEditHost: (hostId: string) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  updateTabHost: (tabId: string, hostId: string) => void;
  updateTabState: (tabId: string, state: ConnectionState) => void;
}

export const ViewContainer: React.FC<ViewContainerProps> = ({
  activeTabId,
  activeGlobalView,
  tabs,
  openSession,
  handleAddHost,
  handleEditHost,
  updateTabTitle,
  updateTabHost,
  updateTabState
}) => {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-main">
      {/* Global Views (Dashboard, Settings, etc.) */}
      <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${activeTabId ? 'hidden' : ''}`}>
        <React.Suspense fallback={<ViewLoading />}>
          {activeGlobalView === ViewMode.SETTINGS && <SettingsView />}
          {activeGlobalView === ViewMode.SNIPPETS && (
            <SnippetListView />
          )}
          {activeGlobalView === ViewMode.HOST_LIST && (
            <HostListView
              onConnect={openSession}
              onEdit={handleEditHost}
              onAdd={handleAddHost}
              tabs={tabs}
            />
          )}
        </React.Suspense>
      </div>

      {/* Tabbed Views (Terminal, SFTP) */}
      <React.Suspense fallback={<ViewLoading />}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`flex-1 flex-col overflow-hidden ${activeTabId === tab.id ? 'flex' : 'hidden'}`}
          >
            {tab.viewMode === ViewMode.TERMINAL && (
              <TerminalView
                hostId={tab.hostId}
                isActive={activeTabId === tab.id}
                tabId={tab.id}
                onStatusChange={(state) => updateTabState(tab.id, state)}
              />
            )}
            {tab.viewMode === ViewMode.SFTP && (
              <SftpView
                hostId={tab.hostId}
                onTitleChange={(title) => updateTabTitle(tab.id, title)}
                onHostChange={(hostId) => updateTabHost(tab.id, hostId)}
              />
            )}
          </div>
        ))}
      </React.Suspense>
    </div>
  );
};
