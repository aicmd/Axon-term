import React from 'react';
import { Monitor, Terminal, Globe, Type, ChevronDown, History, Zap, RefreshCw, Cpu, Layers, Shield, FileText } from 'lucide-react';
import { useI18n } from '../I18nContext';
import { useTheme } from '../ThemeContext';
import { useSettings, AutocompleteType, TerminalEmulationType } from '../SettingsContext';
import SyncSettings from './SyncSettings';

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ icon, label, description, children }) => (
  <div className="flex items-center justify-between py-3 group/row border-b border-border/40 last:border-0">
    <div className="flex items-start gap-3 min-w-0 flex-1">
      <div className="mt-0.5 text-textMuted group-hover/row:text-accent transition-colors">
        {icon}
      </div>
      <div className="min-w-0 pr-4">
        <div className="text-xs font-bold text-textMain tracking-tight">{label}</div>
        {description && <div className="text-[10px] text-textMuted mt-0.5 leading-tight truncate md:whitespace-normal">{description}</div>}
      </div>
    </div>
    <div className="shrink-0">
      {children}
    </div>
  </div>
);

export const SettingsView: React.FC = () => {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { settings, updateSettings } = useSettings();

  return (
    <div className="flex-1 overflow-y-auto bg-main custom-scrollbar">
      <div className="max-w-4xl mx-auto p-6 space-y-6 pb-10">
        {/* Header */}
        <header className="animate-in fade-in slide-in-from-top-4 duration-500">
          <h1 className="text-2xl font-black text-textMain tracking-tighter">{t('settings')}</h1>
          <p className="text-textMuted text-[11px] font-medium mt-1 uppercase tracking-widest opacity-80">{t('settingsDesc')}</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Appearance (Row 1, Col 1) ─────────────────────────────────── */}
          <div className="h-full bg-sidebar/40 backdrop-blur-md border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            <div className="px-5 py-3 border-b border-border bg-sidebar/60 flex items-center gap-2">
              <Monitor size={14} className="text-accent" />
              <h2 className="text-[11px] font-black text-textMain uppercase tracking-widest">{t('appearance')}</h2>
            </div>
            <div className="p-5 space-y-1 flex-1">
              <SettingRow icon={<Layers size={14} />} label={t('themeSelection')} description={t('themeDesc')}>
                <div className="flex bg-main/50 p-0.5 rounded-lg border border-border/50">
                  {(['light', 'dark'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => { if (theme !== mode) toggleTheme(); }}
                      className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${theme === mode
                        ? 'bg-accent text-white shadow-md'
                        : 'text-textMuted hover:text-textMain'
                        }`}
                    >
                      {t(mode === 'dark' ? 'darkMode' : 'lightMode')}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow icon={<Globe size={14} />} label={t('languageSelection')} description={t('langDesc')}>
                <div className="flex bg-main/50 p-0.5 rounded-lg border border-border/50">
                  {(['en', 'zh'] as const).map(l => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${lang === l
                        ? 'bg-accent text-white shadow-md'
                        : 'text-textMuted hover:text-textMain'
                        }`}
                    >
                      {l === 'en' ? 'EN' : 'ZH'}
                    </button>
                  ))}
                </div>
              </SettingRow>
            </div>
          </div>

          {/* ── Autocomplete (Row 1, Col 2) ───────────────────────────────── */}
          <div className="h-full bg-sidebar/40 backdrop-blur-md border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
            <div className="px-5 py-3 border-b border-border bg-sidebar/60 flex items-center gap-2">
              <Zap size={14} className="text-accent" />
              <h2 className="text-[11px] font-black text-textMain uppercase tracking-widest">{t('autocomplete')}</h2>
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <div className="grid grid-cols-3 gap-2">
                {/* TODO: Implement actual autocomplete logic -helium */}
                {(['helium', 'hydrogen', 'disabled'] as AutocompleteType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => type !== 'helium' && updateSettings({ autocomplete: type })}
                    disabled={type === 'helium'}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${settings.autocomplete === type
                      ? 'border-accent bg-accent/10 text-accent shadow-sm'
                      : type === 'helium'
                        ? 'border-border/40 text-textMuted/40 cursor-not-allowed'
                        : 'border-border/60 text-textMuted hover:border-accent/40 hover:bg-hover/50'
                      }`}
                  >
                    {type === 'helium' ? <Zap size={16} /> : type === 'hydrogen' ? <Layers size={16} /> : <Shield size={16} />}
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black uppercase tracking-tighter">{t(type as any)}</span>
                      {type === 'helium' && <span className="text-[8px] font-medium opacity-60">Soon</span>}
                    </div>
                    {settings.autocomplete === type && <div className="w-1 h-1 rounded-full bg-accent animate-pulse"></div>}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-textMuted mt-auto pt-4 text-center italic">{t('autoCompleteDesc')}</p>
            </div>
          </div>

          {/* ── Performance (Row 2, Col 1) ─────────────────────────────────── */}
          <div className="h-full bg-sidebar/40 backdrop-blur-md border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <div className="px-5 py-3 border-b border-border bg-sidebar/60 flex items-center gap-2">
              <RefreshCw size={14} className="text-accent" />
              <h2 className="text-[11px] font-black text-textMain uppercase tracking-widest">{t('performance')}</h2>
            </div>
            <div className="p-5 space-y-1 flex-1">
              <SettingRow icon={<RefreshCw size={14} />} label={t('autoReconnect')} description={t('autoReconnectDesc')}>
                <button
                  onClick={() => updateSettings({ autoReconnect: !settings.autoReconnect })}
                  className={`w-9 h-5 rounded-full relative transition-all duration-300 ${settings.autoReconnect ? 'bg-accent shadow-[0_0_10px_rgba(var(--accent-rgb),0.3)]' : 'bg-hoverDark'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${settings.autoReconnect ? 'left-5' : 'left-1'}`} />
                </button>
              </SettingRow>

              <SettingRow icon={<History size={14} />} label={t('importHistory')} description={t('performanceDesc')}>
                <button
                  onClick={() => updateSettings({ importShellHistory: !settings.importShellHistory })}
                  className={`w-9 h-5 rounded-full relative transition-all duration-300 ${settings.importShellHistory ? 'bg-accent shadow-[0_0_10px_rgba(var(--accent-rgb),0.3)]' : 'bg-hoverDark'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${settings.importShellHistory ? 'left-5' : 'left-1'}`} />
                </button>
              </SettingRow>

              <SettingRow icon={<Monitor size={14} />} label={t('showServerMetrics')} description={t('showServerMetricsDesc')}>
                <button
                  onClick={() => updateSettings({ showServerMetrics: !settings.showServerMetrics })}
                  className={`w-9 h-5 rounded-full relative transition-all duration-300 ${settings.showServerMetrics ? 'bg-accent shadow-[0_0_10px_rgba(var(--accent-rgb),0.3)]' : 'bg-hoverDark'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${settings.showServerMetrics ? 'left-5' : 'left-1'}`} />
                </button>
              </SettingRow>

              <SettingRow icon={<Shield size={14} />} label={t('showSessionInfo')} description={t('showSessionInfoDesc')}>
                <button
                  onClick={() => updateSettings({ showSessionInfo: !settings.showSessionInfo })}
                  className={`w-9 h-5 rounded-full relative transition-all duration-300 ${settings.showSessionInfo ? 'bg-accent shadow-[0_0_10px_rgba(var(--accent-rgb),0.3)]' : 'bg-hoverDark'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${settings.showSessionInfo ? 'left-5' : 'left-1'}`} />
                </button>
              </SettingRow>

              <SettingRow icon={<Terminal size={14} />} label={t('terminalEmulation')} description={t('terminalEmulationDesc')}>
                <div className="relative group/select">
                  <select
                    value={settings.terminalEmulation}
                    onChange={(e) => updateSettings({ terminalEmulation: e.target.value as TerminalEmulationType })}
                    className="bg-main/50 border border-border/50 rounded-lg px-2 py-1 text-[10px] font-bold text-textMain focus:outline-none focus:border-accent appearance-none cursor-pointer pr-6 min-w-[120px] transition-all group-hover/select:border-accent/40"
                  >
                    <option value="xterm-256color">xterm-256color</option>
                    <option value="xterm-16color">xterm-16color</option>
                    <option value="xterm">xterm</option>
                  </select>
                  <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted" />
                </div>
              </SettingRow>
            </div>
          </div>

          {/* ── Typography (Row 2, Col 2) ─────────────────────────────────── */}
          <div className="h-full bg-sidebar/40 backdrop-blur-md border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 delay-250">
            <div className="px-5 py-3 border-b border-border bg-sidebar/60 flex items-center gap-2">
              <Type size={14} className="text-accent" />
              <h2 className="text-[11px] font-black text-textMain uppercase tracking-widest">{t('typography')}</h2>
            </div>
            <div className="p-5 space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-textMuted uppercase tracking-widest">{t('fontFamily')}</label>
                  <div className="relative group/select">
                    <select
                      value={settings.fontFamily}
                      onChange={(e) => updateSettings({ fontFamily: e.target.value })}
                      className="w-full bg-main/50 border border-border/50 rounded-lg px-2 py-1.5 text-[10px] font-bold text-textMain focus:outline-none focus:border-accent appearance-none cursor-pointer transition-all group-hover/select:border-accent/40"
                    >
                      <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                      <option value="'Fira Code', monospace">Fira Code</option>
                      <option value="'Source Code Pro', monospace">Source Code Pro</option>
                      <option value="Menlo, Monaco, monospace">Monaco / Menlo</option>
                    </select>
                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-textMuted uppercase tracking-widest">{t('fontSize')}</label>
                    <input
                      type="number"
                      title={t('fontSizeDesc')}
                      value={settings.fontSize}
                      onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) || 12 })}
                      className="w-full bg-main/50 border border-border/50 rounded-lg px-2 py-1.5 text-[10px] font-mono text-textMain focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-textMuted uppercase tracking-widest">{t('scrollback')}</label>
                    <input
                      type="number"
                      title={t('scrollbackDesc')}
                      value={settings.scrollback}
                      onChange={(e) => updateSettings({ scrollback: parseInt(e.target.value) || 1000 })}
                      className="w-full bg-main/50 border border-border/50 rounded-lg px-2 py-1.5 text-[10px] font-mono text-textMain focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-textMuted uppercase tracking-widest">{t('cursorStyle')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['block', 'underline', 'bar'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => updateSettings({ cursorStyle: style })}
                      className={`py-1.5 rounded-lg border text-[10px] font-bold transition-all ${settings.cursorStyle === style
                        ? 'border-accent bg-accent/10 text-accent shadow-sm'
                        : 'border-border/50 text-textMuted hover:bg-hover/30'
                        }`}
                    >
                      {t(style as any)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-terminal/60 backdrop-blur-sm rounded-xl border border-border/50 font-mono text-[11px] text-textMain/90 relative group overflow-hidden" style={{ fontFamily: settings.fontFamily, fontSize: `${settings.fontSize}px` }}>
                <div className="flex items-center justify-between text-[9px] text-textMuted mb-2 border-b border-border/20 pb-1.5 uppercase tracking-tighter font-black">
                  <div className="flex items-center gap-1.5"><Terminal size={10} /> {t('preview')}</div>
                  <div className="text-accent/60 italic font-medium">{t('rendering')}</div>
                </div>
                <div className="space-y-0.5">
                  <div><span className="text-success">➜</span> <span className="text-accent">~</span> <span className="text-textMuted">git</span> status</div>
                  <div className="text-textMuted/40 italic"># On branch main, everything is clean</div>
                  <div className="flex items-center gap-1">
                    <span className="text-success">➜</span> <span className="text-accent">~</span>
                    <span className={`inline-block bg-accent/80 animate-pulse ml-0.5 ${settings.cursorStyle === 'block' ? 'w-2 h-4' :
                      settings.cursorStyle === 'underline' ? 'w-2 h-[1.5px] mt-3' :
                        'w-[1.5px] h-4'
                      }`}></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Cloud Sync & Security ───────────────────────────────────────── */}
        <div className="lg:col-span-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <div className="bg-gradient-to-br from-accent/5 to-transparent backdrop-blur-md border border-accent/20 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-accent/20 bg-accent/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-accent" />
                <h2 className="text-[11px] font-black text-textMain uppercase tracking-widest">Cloud Sync & Security</h2>
              </div>
              <div className="px-2 py-0.5 bg-accent/20 text-accent rounded text-[8px] font-bold uppercase tracking-widest animate-pulse">End-to-End Encrypted</div>
            </div>
            <div className="p-1">
              <SyncSettings />
            </div>
          </div>
        </div>
      </div>

      {/* ── About Axon ────────────────────────────────────────────────── */}
      <section className="p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
        <div className="bg-gradient-to-br from-sidebar/60 to-sidebar/20 backdrop-blur-xl border border-border rounded-3xl p-6 relative overflow-hidden group shadow-lg">
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent/10 rounded-full -mr-24 -mt-24 blur-[80px] group-hover:bg-accent/20 transition-colors duration-1000"></div>

          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="w-20 h-20 bg-gradient-to-tr from-accent to-accent/60 rounded-2xl flex items-center justify-center shrink-0 shadow-xl shadow-accent/20 rotate-3 group-hover:rotate-0 transition-all duration-700">
              <Terminal size={40} className="text-white" strokeWidth={2.5} />
            </div>

            <div className="flex-1 text-center md:text-left space-y-3">
              <div className="flex flex-col md:flex-row md:items-baseline gap-2">
                <h2 className="text-xl font-black text-textMain tracking-tighter">Axon</h2>
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <span className="px-2 py-0.5 bg-accent/10 text-accent rounded-full text-[8px] font-black uppercase tracking-widest border border-accent/20">Pro</span>
                  <span className="text-[9px] font-bold text-textMuted uppercase tracking-widest">v1.0.0 Stable</span>
                </div>
              </div>

              <p className="text-[11px] text-textMuted leading-relaxed max-w-lg font-medium">
                {t('aboutDesc')}
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-1">
                {[
                  { label: t('systemLogs'), icon: <FileText size={10} /> },
                  { label: t('privacyPolicy'), icon: <Shield size={10} /> },
                  { label: t('licenseAgreement'), icon: <FileText size={10} /> }
                ].map((link, i) => (
                  <button key={i} className="flex items-center gap-1.5 text-[9px] font-black text-accent hover:text-accent/80 transition-colors uppercase tracking-widest">
                    {link.icon} {link.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden lg:flex flex-col items-center justify-center p-4 bg-main/30 rounded-2xl border border-border/50 group/gpu transition-all hover:border-accent/40">
              <Cpu size={24} className="text-accent mb-2 group-hover/gpu:scale-110 transition-transform" />
              <span className="text-[9px] font-black text-textMain uppercase tracking-widest">{t('gpuAccel')}</span>
              <span className="text-[8px] text-textMuted mt-1">{t('enabled')}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
