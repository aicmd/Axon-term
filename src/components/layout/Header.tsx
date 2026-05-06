import React from 'react';
import {
  LayoutPanelLeft, Terminal, Folder, X, ChevronLeft, ChevronRight, Languages, Sun, Moon, PanelRight
} from 'lucide-react';
import { GlobalSearch } from '../GlobalSearch';
import { ViewMode, Tab, Host } from '../../types';
import { useI18n } from '../../I18nContext';
import { useTheme } from '../../ThemeContext';
import { useSettings } from '../../SettingsContext';

import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, Copy } from 'lucide-react';

const appWindow = getCurrentWindow();

interface HeaderProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  tabs: Tab[];
  activeTabId: string | null;
  setActiveTabId: (id: string | null) => void;
  closeTab: (id: string, e: React.MouseEvent) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scrollTabs: (direction: 'left' | 'right') => void;
  openSession: (hostOrId: string | Host | null, mode: ViewMode) => void;
  navigateTo: (view: ViewMode) => void;
  isTerminalActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  tabs,
  activeTabId,
  setActiveTabId,
  closeTab,
  scrollRef,
  canScrollLeft,
  canScrollRight,
  scrollTabs,
  openSession,
  navigateTo,
  isTerminalActive
}) => {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang } = useI18n();
  const { settings, updateSettings } = useSettings();
  const [isMaximized, setIsMaximized] = React.useState(false);

  // Detect platform for Windows-specific controls
  const isWindows = navigator.userAgent.includes('Windows');

  React.useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    };
    checkMaximized();
    
    const unlisten = appWindow.onResized(() => {
      checkMaximized();
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  return (
    <div data-tauri-drag-region className="h-12 bg-sidebar border-b border-border flex items-center px-4 shrink-0 z-30 data-tauri-drag-region select-none">
      <div className="flex items-center gap-4 mr-4 shrink-0">
        <div className="flex gap-2 w-12">
        </div>
        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className={`p-1.5 rounded transition-colors ${isSidebarCollapsed ? 'text-accent bg-accent/10' : 'text-textMuted hover:text-textMain hover:bg-hover'}`}>
          <LayoutPanelLeft size={18} />
        </button>
      </div>

      <GlobalSearch
        onOpenSession={openSession}
        onNavigate={navigateTo}
      />

      <div data-tauri-drag-region className="flex-1 flex items-center min-w-0 h-full select-none relative">
        <button
          onClick={() => scrollTabs('left')}
          className={`tab-scroll-arrow tab-scroll-arrow-left shrink-0 z-10 flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${canScrollLeft ? 'opacity-100 text-textMain bg-sidebar hover:bg-hover shadow-sm border border-border cursor-pointer' : 'opacity-0 pointer-events-none'}`}
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
        </button>
        <div data-tauri-drag-region ref={scrollRef} className={`flex-1 flex items-center overflow-x-auto no-scrollbar gap-1 h-full tab-scroll-container ${canScrollLeft ? 'mask-fade-left' : ''} ${canScrollRight ? 'mask-fade-right' : ''}`}>
          {tabs.map(tab => (
            <div key={tab.id} onClick={() => setActiveTabId(tab.id)} className={`group flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px] rounded-md border transition-all cursor-pointer select-none shrink-0 ${activeTabId === tab.id ? 'bg-main border-border text-textMain shadow-sm' : 'bg-transparent border-transparent text-textMuted hover:bg-hover/50'}`}>
              {tab.viewMode === ViewMode.TERMINAL ? <Terminal size={14} /> : <Folder size={14} />}
              <span className="text-xs font-medium truncate flex-1">{tab.title}</span>
              <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id, e); }} className={`p-0.5 rounded-full hover:bg-hoverDark ${activeTabId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><X size={12} /></button>
            </div>
          ))}
        </div>
        <button
          onClick={() => scrollTabs('right')}
          className={`tab-scroll-arrow tab-scroll-arrow-right shrink-0 z-10 flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${canScrollRight ? 'opacity-100 text-textMain bg-sidebar hover:bg-hover shadow-sm border border-border cursor-pointer' : 'opacity-0 pointer-events-none'}`}
        >
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex items-center gap-1 ml-4 shrink-0 h-full">
        <button onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} className="p-2 text-textMuted hover:text-textMain hover:bg-hover rounded-lg transition-colors"><Languages size={18} /></button>
        <button onClick={toggleTheme} className="p-2 text-textMuted hover:text-textMain hover:bg-hover rounded-lg transition-colors">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>

        {isTerminalActive && (
          <>
            <div className="w-px h-4 bg-border mx-1"></div>
            <button
              onClick={() => updateSettings({ isRightSidebarOpen: !settings.isRightSidebarOpen })}
              className={`p-2 rounded-lg transition-colors ${settings.isRightSidebarOpen ? 'text-accent bg-hover' : 'text-textMuted hover:text-textMain hover:bg-hover'}`}
            >
              <PanelRight size={18} />
            </button>
          </>
        )}

        {isWindows && (
          <div className="flex items-center ml-2 border-l border-border pl-2 h-full">
            <button 
              onClick={() => appWindow.minimize()}
              className="w-10 h-full flex items-center justify-center text-textMuted hover:bg-hover hover:text-textMain transition-colors"
            >
              <Minus size={16} />
            </button>
            <button 
              onClick={() => appWindow.toggleMaximize()}
              className="w-10 h-full flex items-center justify-center text-textMuted hover:bg-hover hover:text-textMain transition-colors"
            >
              {isMaximized ? <Copy size={14} className="rotate-180" /> : <Square size={12} />}
            </button>
            <button 
              onClick={() => appWindow.close()}
              className="w-10 h-full flex items-center justify-center text-textMuted hover:bg-error hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
