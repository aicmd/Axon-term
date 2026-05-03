import React from 'react';
import {
  Braces, List, Folder, Settings, Plus, Terminal
} from 'lucide-react';
import { ViewMode, ConnectionState, Host, Tab } from '../../types';
import { useI18n } from '../../I18nContext';
import { getStatusColor } from '../../utils/statusUtils';

interface SidebarItemProps {
  icon: React.ReactElement;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, isActive, isCollapsed, onClick }) => {
  return (
    <button
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={`group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${isCollapsed ? 'justify-center p-2.5 mx-auto' : 'px-3 py-2.5 mx-2'
        } ${isActive
          ? 'bg-accent/10 text-accent shadow-sm'
          : 'text-textMuted hover:bg-hover hover:text-textMain'
        }`}
    >
      {isActive && (
        <div
          className={`absolute left-0 w-1 bg-accent rounded-r-full transition-all duration-300 ${isCollapsed ? 'h-6 top-2' : 'h-5 top-2.5'
            }`}
        />
      )}

      <div className={`transition-transform duration-200 group-active:scale-90 ${isCollapsed ? '' : 'mr-3'}`}>
        {React.cloneElement(icon as React.ReactElement<any>, {
          size: 20,
          strokeWidth: isActive ? 2.5 : 2
        })}
      </div>

      {!isCollapsed && (
        <span className="flex-1 text-left truncate">{label}</span>
      )}

      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-sidebarDark text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-border/50">
          {label}
        </div>
      )}
    </button>
  );
};

interface SidebarProps {
  isCollapsed: boolean;
  activeTabId: string | null;
  activeGlobalView: ViewMode;
  hosts: Host[];
  tabs: Tab[];
  onNavigate: (view: ViewMode) => void;
  onOpenSession: (hostId: string | null, mode: ViewMode) => void;
  onSelectTab?: (tabId: string) => void;
  onAddHost: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  activeTabId,
  activeGlobalView,
  hosts,
  onNavigate,
  onOpenSession,
  onSelectTab,
  onAddHost,
  tabs
}) => {
  const { t } = useI18n();

  // Combine host config with real-time tab state
  const hostsWithState = hosts.map(h => {
    const activeTab = tabs.find(t => t.hostId === h.id);
    return {
      ...h,
      state: activeTab ? activeTab.state : ConnectionState.DISCONNECTED
    };
  });

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-56'} flex flex-col bg-sidebar border-r border-border transition-all duration-300 z-20 overflow-hidden shadow-lg`}>
      {/* Logo Section */}
      {/* <div className={`h-16 flex items-center px-4 shrink-0 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent to-accent/60 flex items-center justify-center text-white shadow-lg shadow-accent/20">
          <Braces size={22} strokeWidth={2.5} />
        </div>
        {!isCollapsed && (
          <div className="ml-3 font-black text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-textMain to-textMuted whitespace-nowrap">
            AXON
          </div>
        )}
      </div> */}

      <div className="flex-1 overflow-hidden py-2 flex flex-col gap-0.5 custom-scrollbar">
        {!isCollapsed && (
          <div className="text-[10px] font-bold text-textMuted/60 uppercase tracking-[0.2em] mt-4 mb-2 px-6">
            {t('navigation')}
          </div>
        )}
        <SidebarItem
          icon={<List />}
          label={t('hostList')}
          isActive={activeTabId === null && activeGlobalView === ViewMode.HOST_LIST}
          isCollapsed={isCollapsed}
          onClick={() => onNavigate(ViewMode.HOST_LIST)}
        />
        <SidebarItem
          icon={<Terminal />}
          label={t('localTerminal')}
          isActive={false}
          isCollapsed={isCollapsed}
          onClick={() => onOpenSession(null, ViewMode.TERMINAL)}
        />
        <SidebarItem
          icon={<Folder />}
          label={t('sftp')}
          isActive={false}
          isCollapsed={isCollapsed}
          onClick={() => onOpenSession(null, ViewMode.SFTP)}
        />
        <SidebarItem
          icon={<Braces />}
          label={t('snippets')}
          isActive={activeTabId === null && activeGlobalView === ViewMode.SNIPPETS}
          isCollapsed={isCollapsed}
          onClick={() => onNavigate(ViewMode.SNIPPETS)}
        />

        {!isCollapsed && (
          <div className="mt-8 mb-6">
            <div className="flex items-center justify-between text-[10px] font-bold text-textMuted/60 uppercase tracking-[0.2em] mb-3 px-6">
              <span>{t('quickConnect')}</span>
              <button onClick={onAddHost} className="hover:text-accent transition-colors">
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
            <div className="px-4 space-y-1">
              {hostsWithState.slice(0, 5).map(host => {
                const existingTab = tabs.find(t => t.hostId === host.id);
                return (
                  <button
                    key={host.id}
                    className="w-full flex items-center gap-3 px-3 py-2 text-textMuted hover:text-textMain hover:bg-hover rounded-xl transition-all group text-sm"
                    onClick={() => {
                      if (existingTab) {
                        onSelectTab?.(existingTab.id);
                      } else {
                        onOpenSession(host.id, ViewMode.TERMINAL);
                      }
                    }}
                  >
                    <div className={`w-2 h-2 rounded-full ring-4 ring-transparent group-hover:ring-accent/10 transition-all ${getStatusColor(host.state as ConnectionState, !!existingTab)}`}></div>
                    <span className="truncate font-medium">{host.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-border bg-sidebar/50 backdrop-blur-sm flex flex-col gap-0.5 shrink-0">
        <SidebarItem
          icon={<Settings />}
          label={t('settings')}
          isActive={activeTabId === null && activeGlobalView === ViewMode.SETTINGS}
          isCollapsed={isCollapsed}
          onClick={() => onNavigate(ViewMode.SETTINGS)}
        />

        {/* User Profile Section */}
        {/* <div className={`mt-1 flex items-center p-2 rounded-xl hover:bg-hover transition-all cursor-pointer group ${isCollapsed ? 'justify-center' : 'mx-1'}`}>
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent overflow-hidden shadow-inner">
            <User size={18} />
          </div>
          {!isCollapsed && (
            <div className="ml-3 flex-1 min-w-0">
              <div className="text-xs font-bold text-textMain truncate">Developer</div>
              <div className="text-[10px] text-textMuted truncate">Axon Pro Plan</div>
            </div>
          )}
        </div> */}
      </div>
    </div>
  );
};
