import React, { useState, useEffect, useRef } from 'react';
import { HostEditorModal } from './components/HostEditorModal';
import { RightDrawer } from './components/RightDrawer';
import { ViewMode, Tab, ConnectionState } from './types';
import { useI18n } from './I18nContext';
import { useHosts } from './HostContext';
import { useSettings } from './SettingsContext';

import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ViewContainer } from './components/layout/ViewContainer';

const SIDEBAR_COLLAPSE_BREAKPOINT_PX = 800;
const TAB_SCROLL_RATIO = 0.8;
const MIN_TAB_SCROLL_PX = 120;

const App: React.FC = () => {
  const { t } = useI18n();
  const { hosts } = useHosts();
  const { settings } = useSettings();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isHostEditorOpen, setIsHostEditorOpen] = useState(false);
  const [editingHostId, setEditingHostId] = useState<string | null>(null);

  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [activeGlobalView, setActiveGlobalView] = useState<ViewMode>(ViewMode.HOST_LIST);
  const [tabs, setTabs] = useState<Tab[]>([]);


  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (!activeTabId) {
        if (window.innerWidth < SIDEBAR_COLLAPSE_BREAKPOINT_PX) setIsSidebarCollapsed(true);
        else setIsSidebarCollapsed(false);
      }
      checkScroll();
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTabId]);

  useEffect(() => {
    if (activeTabId) setIsSidebarCollapsed(true);
    else {
      if (window.innerWidth < SIDEBAR_COLLAPSE_BREAKPOINT_PX) setIsSidebarCollapsed(true);
      else setIsSidebarCollapsed(false);
    }
  }, [activeTabId]);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const isTerminalActive = activeTab?.viewMode === ViewMode.TERMINAL;

  const checkScroll = React.useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 1);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      const observer = new MutationObserver(checkScroll);
      observer.observe(el, { childList: true, subtree: true });
      return () => {
        el.removeEventListener('scroll', checkScroll);
        observer.disconnect();
      };
    }
  }, [tabs, checkScroll]);

  const scrollTabs = React.useCallback((direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const visibleWidth = scrollRef.current.clientWidth;
      const scrollAmount = Math.max(visibleWidth * TAB_SCROLL_RATIO, MIN_TAB_SCROLL_PX);
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  }, []);

  const closeTab = React.useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id);
      if (activeTabId === id) {
        if (newTabs.length > 0) setActiveTabId(newTabs[newTabs.length - 1].id);
        else {
          setActiveTabId(null);
          setActiveGlobalView(ViewMode.HOST_LIST);
        }
      }
      return newTabs;
    });
  }, [activeTabId]);

  const openSession = React.useCallback((hostId: string | null, mode: ViewMode) => {
    const startTime = Date.now();
    if (hostId) {
      const host = hosts.find(h => h.id === hostId);
      if (host) {
        const newTabId = `session_${startTime}`;
        setTabs(prev => [...prev, { id: newTabId, hostId, title: host.name, viewMode: mode, startTime, state: ConnectionState.CONNECTING }]);
        setActiveTabId(newTabId);
        return;
      }
    }

    // Local session fallback
    const newTabId = `local_${startTime}`;
    const title = mode === ViewMode.SFTP ? t('sftp') : t('localTerminal');
    setTabs(prev => [...prev, { id: newTabId, hostId: '', title, viewMode: mode, startTime, state: ConnectionState.CONNECTED }]);
    setActiveTabId(newTabId);
  }, [hosts, t]);

  const updateTabTitle = React.useCallback((tabId: string, title: string) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (tab && tab.title === title) return prev;
      return prev.map(t => t.id === tabId ? { ...t, title } : t);
    });
  }, []);

  const updateTabState = React.useCallback((tabId: string, state: ConnectionState) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (tab && tab.state === state) return prev;
      return prev.map(t => t.id === tabId ? { ...t, state } : t);
    });
  }, []);

  const updateTabHost = React.useCallback((tabId: string, hostId: string) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (tab && tab.hostId === hostId) return prev;
      return prev.map(t => t.id === tabId ? { ...t, hostId } : t);
    });
  }, []);

  const handleEditHost = React.useCallback((hostId: string) => {
    setEditingHostId(hostId);
    setIsHostEditorOpen(true);
  }, []);

  const handleAddHost = React.useCallback(() => {
    setEditingHostId(null);
    setIsHostEditorOpen(true);
  }, []);

  const navigateTo = React.useCallback((view: ViewMode) => {
    setActiveTabId(null);
    setActiveGlobalView(view);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-main text-textMain overflow-hidden font-sans selection:bg-accent/30">
      <Header
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        tabs={tabs}
        activeTabId={activeTabId}
        setActiveTabId={setActiveTabId}
        closeTab={closeTab}
        scrollRef={scrollRef}
        canScrollLeft={canScrollLeft}
        canScrollRight={canScrollRight}
        scrollTabs={scrollTabs}
        openSession={openSession}
        navigateTo={navigateTo}
        isTerminalActive={isTerminalActive}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          activeTabId={activeTabId}
          activeGlobalView={activeGlobalView}
          hosts={hosts}
          tabs={tabs}
          onNavigate={navigateTo}
          onOpenSession={openSession}
          onSelectTab={setActiveTabId}
          onAddHost={handleAddHost}
        />

        <div className="flex-1 flex overflow-hidden relative">
          <ViewContainer
            activeTabId={activeTabId}
            activeGlobalView={activeGlobalView}
            tabs={tabs}
            hosts={hosts}
            openSession={openSession}
            handleAddHost={handleAddHost}
            handleEditHost={handleEditHost}
            updateTabTitle={updateTabTitle}
            updateTabHost={updateTabHost}
            updateTabState={updateTabState}
          />

          <RightDrawer
            isOpen={isTerminalActive && settings.isRightSidebarOpen}
            activeTabId={activeTabId || undefined}
            activeHost={(() => {
              const activeTab = tabs.find(t => t.id === activeTabId);
              return activeTab ? hosts.find(h => h.id === activeTab.hostId) : null;
            })()}
            tabs={tabs}
          />
        </div>
      </div>

      <HostEditorModal
        isOpen={isHostEditorOpen}
        onClose={() => setIsHostEditorOpen(false)}
        onConnect={openSession}
        hostId={editingHostId || undefined}
      />
    </div>
  );
};

export default App;