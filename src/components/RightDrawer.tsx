import React from 'react';
import { Activity, Cpu, MemoryStick, TerminalSquare, Play, Info, Globe, User, Clock, ShieldCheck, Terminal as TerminalIcon, Sparkles } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { COLORS } from '../constants';
import { Host, Tab } from '../types';
import { useI18n } from '../I18nContext';
import { useSnippets } from '../SnippetContext';
import { Skeleton } from './common/Skeleton';
import { Sparkline } from './common/Sparkline';
import { useSettings } from '../SettingsContext';

interface RightDrawerProps {
  isOpen: boolean;
  activeHost: Host | null | undefined;
  activeTabId?: string;
  tabs: Tab[];
}

type Section = 'snippets' | 'metrics' | 'info' | 'history';

const METRICS_POLLING_INTERVAL = 3000;
const INITIAL_METRICS_DELAY = 150;
const UPTIME_UPDATE_INTERVAL = 1000;

const formatDuration = (ms: number) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const generateData = (base: number) => Array.from({ length: 20 }, (_, i) => ({
  time: i,
  value: base
}));



export const RightDrawer: React.FC<RightDrawerProps> = ({ isOpen, activeHost, activeTabId, tabs }) => {
  const { t } = useI18n();
  const { settings } = useSettings();
  const { snippets, history, runSnippet, clearHistory, syncLocalHistory, syncRemoteHistory } = useSnippets();
  const [activeSection, setActiveSection] = React.useState<Section>('snippets');
  const [uptime, setUptime] = React.useState("00:00:00");

  const [cpuData, setCpuData] = React.useState(generateData(30));
  const [ramData, setRamData] = React.useState(generateData(45));
  const [isMetricsLoading, setIsMetricsLoading] = React.useState(false);

  // Define available tabs based on settings
  const availableTabs = React.useMemo(() => {
    return [
      { id: 'snippets', icon: <TerminalSquare size={16} />, label: t('snippets'), visible: true },
      { id: 'history', icon: <Clock size={16} />, label: t('history'), visible: true },
      { id: 'metrics', icon: <Activity size={16} />, label: t('serverMetrics'), visible: settings.showServerMetrics },
      { id: 'info', icon: <Info size={16} />, label: t('sessionInfo'), visible: settings.showSessionInfo }
    ].filter(tab => tab.visible);
  }, [t, settings.showServerMetrics, settings.showSessionInfo]);

  // If the active section is no longer visible, switch to snippets
  React.useEffect(() => {
    if (!availableTabs.find(tab => tab.id === activeSection)) {
      setActiveSection('snippets');
    }
  }, [availableTabs, activeSection]);

  React.useEffect(() => {
    if (activeHost?.id) {
      setCpuData(generateData(0));
      setRamData(generateData(0));
    }
  }, [activeHost?.id]);

  React.useEffect(() => {
    // Optimization: Stop metrics polling if drawer is closed, tab is not metrics, or feature is disabled
    if (!isOpen || activeSection !== 'metrics' || !settings.showServerMetrics) return;

    let isMounted = true;
    const fetchMetrics = async (isInitial = false) => {
      if (activeHost?.id) {
        if (isInitial) setIsMetricsLoading(true);
        try {
          const metrics = await invoke<{ cpu: number; ram: number }>('get_remote_metrics', { id: activeHost.id });
          if (!isMounted) return;

          setCpuData(prev => [...prev.slice(1), { time: prev[prev.length - 1].time + 1, value: metrics.cpu }]);
          setRamData(prev => [...prev.slice(1), { time: prev[prev.length - 1].time + 1, value: metrics.ram }]);
          setIsMetricsLoading(false);
          return;
        } catch (err) {
          console.error("Failed to fetch remote metrics:", err);
          if (isMounted) setIsMetricsLoading(false);
        }
      }

      // Keep previous value if failed or local
      if (!isMounted) return;
      setCpuData(prev => [...prev.slice(1), { time: prev[prev.length - 1].time + 1, value: prev[prev.length - 1].value }]);
      setRamData(prev => [...prev.slice(1), { time: prev[prev.length - 1].time + 1, value: prev[prev.length - 1].value }]);
      setIsMetricsLoading(false);
    };

    const initialTimer = setTimeout(() => {
      if (isMounted) fetchMetrics(true);
    }, INITIAL_METRICS_DELAY);

    const interval = setInterval(() => fetchMetrics(false), METRICS_POLLING_INTERVAL);
    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [activeHost?.id, activeSection, isOpen, settings.showServerMetrics]);

  React.useEffect(() => {
    // Optimization: Stop uptime timer if drawer is closed or feature is disabled
    if (!isOpen || !settings.showSessionInfo) {
      setUptime("00:00:00");
      return;
    }

    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || !activeTab.startTime) {
      setUptime("00:00:00");
      return;
    }

    const updateUptime = () => {
      const diff = Date.now() - activeTab.startTime;
      setUptime(formatDuration(diff));
    };

    updateUptime();
    const interval = setInterval(updateUptime, UPTIME_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [activeTabId, tabs, isOpen, settings.showSessionInfo]);

  // Sync history when history tab is opened
  React.useEffect(() => {
    if (!isOpen || activeSection !== 'history') return;
    
    if (activeHost && activeHost.id) {
      syncRemoteHistory(activeHost.id);
    } else {
      syncLocalHistory();
    }
  }, [activeSection, activeHost, syncLocalHistory, syncRemoteHistory, isOpen]);

  const filteredHistory = React.useMemo(() => {
    const currentContext = activeHost?.id || 'local';
    return history.filter(item => (item.hostId || 'local') === currentContext);
  }, [history, activeHost?.id]);

  if (!isOpen) return null;

  return (
    <div className="w-72 bg-sidebar border-l border-border flex flex-col h-full overflow-hidden shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Tabs Header - Height synced with App header (h-12) */}
      <div className="flex h-12 border-b border-border bg-sidebar shrink-0 px-1 items-center">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as Section)}
            className={`flex-1 h-10 flex flex-col items-center justify-center gap-0.5 rounded-md transition-all relative ${activeSection === tab.id
              ? 'text-accent'
              : 'text-textMuted hover:text-textMain hover:bg-hover/40'
              }`}
            title={tab.label}
          >
            {tab.icon}
            <span className="text-[8px] uppercase font-bold tracking-tighter">{tab.label}</span>
            {activeSection === tab.id && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-accent rounded-full animate-in fade-in zoom-in duration-300"></div>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Quick Snippets Section */}
        <div className={`flex-1 flex flex-col overflow-hidden ${activeSection === 'snippets' ? 'block animate-in fade-in slide-in-from-bottom-2 duration-300' : 'hidden'}`}>
          <div className="px-5 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                  <TerminalSquare size={16} />
                </div>
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-textMain">{t('snippets')}</h3>
                  <p className="text-[9px] text-textMuted leading-none mt-0.5">{snippets.length} {t('itemsAvailable')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-4 space-y-2">
            {snippets.map(snippet => (
              <div
                key={snippet.id}
                className="group bg-main/50 border border-border rounded-xl p-3 hover:border-accent/40 hover:bg-main transition-all cursor-default shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-textMain truncate">{snippet.name}</div>
                    <div className="text-[9px] text-textMuted uppercase tracking-wider mt-0.5">{snippet.category || 'General'}</div>
                  </div>
                  <button
                    onClick={() => runSnippet(snippet.command, activeTabId, snippet.name)}
                    className="w-7 h-7 flex items-center justify-center bg-accent/10 text-accent hover:bg-accent hover:text-main rounded-lg transition-all transform active:scale-90 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                    title={t('runInTerminal')}
                    disabled={!activeTabId}
                  >
                    <Play size={10} fill="currentColor" />
                  </button>
                </div>
                <div className="text-[10px] font-mono text-textMuted/80 truncate bg-sidebar/50 px-2 py-1.5 rounded-lg border border-border/50 group-hover:border-accent/20 transition-all leading-tight">
                  {snippet.command}
                </div>
              </div>
            ))}
            {snippets.length === 0 && (
              <div className="text-[10px] text-textMuted text-center py-8 opacity-60">
                {t('noSnippets')}
              </div>
            )}
          </div>
        </div>

        {/* History Section */}
        <div className={`flex-1 flex flex-col overflow-hidden ${activeSection === 'history' ? 'block animate-in fade-in slide-in-from-bottom-2 duration-300' : 'hidden'}`}>
          <div className="px-5 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                  <Clock size={16} />
                </div>
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-textMain">{t('history')}</h3>
                  <p className="text-[9px] text-textMuted leading-none mt-0.5">{filteredHistory.length} recently used</p>
                </div>
              </div>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="px-2 py-1 rounded-md text-[9px] text-error hover:bg-error/10 uppercase font-bold tracking-wider transition-colors"
                >
                  {t('clearHistory')}
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-4 space-y-3">
            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 opacity-40">
                <Clock size={32} strokeWidth={1.5} className="mb-3" />
                <div className="text-[10px] font-bold uppercase tracking-widest">{t('noHistory')}</div>
                <p className="text-[9px] mt-1 text-center px-6">
                  {activeHost ? t('runCommandsHistory') : t('localHistoryEmpty')}
                </p>
              </div>
            ) : (
              filteredHistory.map(item => (
                <div
                  key={item.id}
                  className="group bg-main/30 border border-border/50 rounded-xl p-3 hover:border-accent/30 hover:bg-main/50 transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        {item.type === 'system' ? (
                          <TerminalIcon size={10} className="text-textMuted" />
                        ) : item.type === 'snippet' ? (
                          <Sparkles size={10} className="text-accent" />
                        ) : (
                          <Clock size={10} className="text-textMuted" />
                        )}
                        <div className="text-[10px] font-bold text-textMain truncate">
                          {item.name || (item.type === 'system' ? 'System' : 'Manual')}
                        </div>
                      </div>
                      <div className="text-[8px] text-textMuted">
                        {item.timestamp ? new Date(item.timestamp).toLocaleString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        }).replace(/\//g, '-') : '--:--'}
                      </div>
                    </div>
                    <button
                      onClick={() => runSnippet(item.command, activeTabId, item.name, activeHost?.id || 'local')}
                      className="w-6 h-6 flex items-center justify-center bg-accent/5 text-accent hover:bg-accent hover:text-main rounded-md transition-all disabled:opacity-30"
                      disabled={!activeTabId}
                    >
                      <Play size={8} fill="currentColor" />
                    </button>
                  </div>
                  <div className="text-[9px] font-mono text-textMuted/70 truncate bg-sidebar/30 px-2 py-1 rounded border border-border/30">
                    {item.command || 'No command'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Metrics Section */}
        <div className={`flex-1 flex flex-col overflow-hidden ${activeSection === 'metrics' ? 'block animate-in fade-in slide-in-from-bottom-2 duration-300' : 'hidden'}`}>
          <div className="px-5 py-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isMetricsLoading ? 'bg-accent/10 text-accent animate-pulse' : 'bg-success/10 text-success'}`}>
                <Activity size={16} />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-textMain">{t('serverMetrics')}</h3>
                <p className="text-[9px] text-textMuted leading-none mt-0.5">{isMetricsLoading ? t('refreshingData') : t('liveStats')}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-6">
            {activeHost ? (
              <div className="space-y-6">
                <div className={`bg-main/30 p-3 rounded-xl border border-border/50 relative overflow-hidden transition-all ${isMetricsLoading ? 'opacity-80' : ''}`}>
                  {isMetricsLoading && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/20 to-transparent animate-shimmer -translate-x-full"></div>}
                  <div className="flex justify-between text-xs mb-2 px-1">
                    <span className="text-textMuted flex items-center gap-1.5"><Cpu size={12} className="text-accent" /> CPU</span>
                    <span className="text-textMain font-bold">
                      {isMetricsLoading ? <Skeleton className="w-10 h-4" /> : `${Math.round(cpuData[cpuData.length - 1].value)}%`}
                    </span>
                  </div>
                  <div className="h-16 w-full">
                    {isMetricsLoading ? (
                      <Skeleton className="w-full h-full rounded-lg" />
                    ) : (
                      <Sparkline data={cpuData} color={COLORS.accent} />
                    )}
                  </div>
                </div>

                <div className={`bg-main/30 p-3 rounded-xl border border-border/50 relative overflow-hidden transition-all ${isMetricsLoading ? 'opacity-80' : ''}`}>
                  {isMetricsLoading && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-success/20 to-transparent animate-shimmer -translate-x-full"></div>}
                  <div className="flex justify-between text-xs mb-2 px-1">
                    <span className="text-textMuted flex items-center gap-1.5"><MemoryStick size={12} className="text-success" /> RAM</span>
                    <span className="text-textMain font-bold">
                      {isMetricsLoading ? <Skeleton className="w-10 h-4" /> : `${Math.round(ramData[ramData.length - 1].value)}%`}
                    </span>
                  </div>
                  <div className="h-16 w-full">
                    {isMetricsLoading ? (
                      <Skeleton className="w-full h-full rounded-lg" />
                    ) : (
                      <Sparkline data={ramData} color={COLORS.success} />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-textMuted italic text-center py-4">{t('noActiveSessions')}</div>
            )}
          </div>
        </div>

        {/* Session Info Section */}
        <div className={`flex-1 flex flex-col overflow-hidden ${activeSection === 'info' ? 'block animate-in fade-in slide-in-from-bottom-2 duration-300' : 'hidden'}`}>
          <div className="px-5 py-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                <Info size={16} />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-textMain">{t('sessionInfo')}</h3>
                <p className="text-[9px] text-textMuted leading-none mt-0.5">Host & protocol details</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-6">
            {activeHost ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between group">
                  <span className="text-xs text-textMuted flex items-center gap-2"><Globe size={12} /> {t('hostname')}</span>
                  <span className="text-xs text-textMain font-mono bg-hover px-1.5 py-0.5 rounded border border-border/50 group-hover:border-accent/30 transition-colors">{activeHost.address}</span>
                </div>
                <div className="flex items-center justify-between group">
                  <span className="text-xs text-textMuted flex items-center gap-2"><User size={12} /> {t('username')}</span>
                  <span className="text-xs text-textMain font-medium">{activeHost.username}</span>
                </div>
                <div className="flex items-center justify-between group">
                  <span className="text-xs text-textMuted flex items-center gap-2"><ShieldCheck size={12} /> {t('protocol')}</span>
                  <span className="text-xs text-textMain">SSH / SFTP</span>
                </div>
                <div className="flex items-center justify-between group">
                  <span className="text-xs text-textMuted flex items-center gap-2"><Clock size={12} /> {t('uptime')}</span>
                  <span className="text-xs text-success font-medium">{uptime}</span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-textMuted italic bg-hover/30 p-3 rounded-lg border border-dashed border-border text-center">
                {t('noActiveSessions')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
