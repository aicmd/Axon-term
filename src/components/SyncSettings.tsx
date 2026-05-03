import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useI18n } from '../I18nContext';
import { useSettings, SecretStorageType } from '../SettingsContext';

interface GithubUser {
  login: string;
  avatar_url?: string;
}

const GITHUB_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const SyncSettings: React.FC = () => {
  const { t } = useI18n();
  const { settings, updateSettings } = useSettings();
  const [user, setUser] = useState<GithubUser | null>(null);
  const [masterPassword, setMasterPassword] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [deviceCode, setDeviceCode] = useState<{ userCode: string; verificationUri: string } | null>(null);

  useEffect(() => {
    invoke<GithubUser | null>('get_github_auth_status').then(setUser).catch(() => { });
    const unlistenAuth = listen<GithubUser>('github-auth-status', (event) => {
      setUser(event.payload);
      setDeviceCode(null);
      setLoading(null);
      showMessage('success', t('loginSuccess').replace('{user}', event.payload.login));
    });
    const unlistenDevice = listen<{ user_code: string; verification_uri: string }>('github-device-code', (event) => {
      setDeviceCode({ userCode: event.payload.user_code, verificationUri: event.payload.verification_uri });
    });
    return () => {
      unlistenAuth.then(f => f());
      unlistenDevice.then(f => f());
    };
  }, [t]);

  // Sync saved storage mode to backend once on mount
  useEffect(() => {
    invoke('set_secret_storage_mode', { mode: settings.secretStorage }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStorageModeChange = async (mode: SecretStorageType) => {
    setLoading('storage');
    try {
      await invoke('set_secret_storage_mode', { mode });
      updateSettings({ secretStorage: mode });
      showMessage('success', t('storageSwitched'));
    } catch (err: any) {
      showMessage('error', String(err));
    } finally {
      setLoading(null);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const runAction = async (id: string, successMsg: string, fn: () => Promise<any>) => {
    setLoading(id);
    try {
      await fn();
      if (successMsg) showMessage('success', successMsg);
    } catch (err: any) {
      const errMsg = String(err);
      if (errMsg.includes('Master Password not set')) {
        showMessage('error', t('errorMasterPasswordNotSet'));
      } else if (errMsg.includes('Master Password is incorrect')) {
        showMessage('error', t('errorIncorrectPasswordForCloud'));
      } else {
        showMessage('error', errMsg);
      }
    } finally {
      setLoading(null);
    }
  };

  const handleLogin = () => runAction('auth', '', () => invoke('login_to_github'));
  const handleLogout = () => runAction('logout', t('logoutSuccess'), async () => {
    await invoke('logout_from_github');
    setUser(null);
  });
  const handleSyncUp = () => runAction('push', t('pushedSuccess'), () => invoke('sync_to_github'));
  const handleSyncDown = () => runAction('pull', t('pulledSuccess'), () => invoke('sync_from_github'));
  const handleUpdateKey = () => {
    if (masterPassword.length < 8) return showMessage('error', t('passwordMinChars'));
    runAction('updateKey', t('keyUpdated'), async () => {
      await invoke('change_master_password', { newPassword: masterPassword });
      setMasterPassword('');
    });
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-main text-textMain animate-in fade-in duration-500 relative">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight">{t('syncSecurity')}</h1>
          <p className="text-textMuted text-xs">{t('syncSecurityDesc')}</p>
        </div>

        {/* Device Code Banner */}
        {deviceCode && (
          <div className="bg-accent/10 border border-accent/30 rounded-2xl p-5 flex flex-col items-center gap-3 animate-in fade-in duration-300">
            <p className="text-xs text-textMuted text-center">{t('enterCodeAt') || 'Enter this code at'} <a href={deviceCode.verificationUri} target="_blank" rel="noreferrer" className="text-accent underline font-medium">{deviceCode.verificationUri}</a></p>
            <div 
              onClick={() => {
                navigator.clipboard.writeText(deviceCode.userCode);
                showMessage('success', t('copied'));
              }}
              className="text-3xl font-black tracking-[0.3em] text-accent font-mono select-all px-6 py-3 bg-main rounded-xl border border-accent/20 cursor-pointer hover:bg-main/80 transition-colors"
            >
              {deviceCode.userCode}
            </div>
            <p className="text-[10px] text-textMuted/60">{t('waitingForAuth') || 'Waiting for authorization...'}</p>
          </div>
        )}

        {/* Floating Notification */}
        {message && (
          <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-in slide-in-from-top-4 duration-300">
            <div className={`p-3 rounded-xl border shadow-2xl backdrop-blur-md flex items-center justify-center text-sm font-medium ${message.type === 'success'
              ? 'bg-success/20 border-success/30 text-success'
              : 'bg-error/20 border-error/30 text-error'
              }`}>
              {message.text}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* GitHub Sync Card */}
          <div className="bg-sidebar border border-border/60 rounded-2xl p-5 space-y-5 flex flex-col shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-textMuted/80">{t('githubCloudSync')}</h2>
              {user && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-success/10 text-success text-[10px] rounded-full font-bold">
                  <div className="w-1 h-1 rounded-full bg-success animate-pulse" />
                  {t('connected')}
                </div>
              )}
            </div>

            {!user ? (
              <div className="flex-1 flex flex-col justify-between gap-4">
                <p className="text-xs text-textMuted leading-relaxed">{t('githubSyncDesc')}</p>
                <button
                  onClick={handleLogin}
                  disabled={loading === 'auth'}
                  className="w-full bg-accent hover:opacity-90 transition-all text-main py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-accent/20"
                >
                  {loading === 'auth' ? t('connecting') : <>{GITHUB_ICON} {t('linkGithub')}</>}
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between gap-5">
                <div className="flex items-center gap-3 p-3 bg-main/40 rounded-xl border border-border/50">
                  {user.avatar_url && <img src={user.avatar_url} alt={user.login} className="w-8 h-8 rounded-full border border-border/50 shadow-sm" />}
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] text-textMuted uppercase font-bold opacity-60">{t('account')}</p>
                    <p className="text-sm font-bold truncate leading-tight">{user.login}</p>
                  </div>
                  <button onClick={handleLogout} className="text-[9px] bg-error/10 text-error px-2 py-1 rounded-lg hover:bg-error/20 transition-colors font-black uppercase tracking-tighter">{t('signOut')}</button>
                </div>

                <div className="space-y-2.5">
                  <div className="flex gap-2">
                    <button onClick={handleSyncUp} disabled={!!loading} className="flex-1 bg-accent text-main py-2 rounded-xl text-xs font-bold shadow-md shadow-accent/10 hover:opacity-90 transition-all active:scale-[0.98]">
                      {loading === 'push' ? t('pushing') : t('pushToCloud')}
                    </button>
                    <button onClick={handleSyncDown} disabled={!!loading} className="flex-1 border border-border bg-main/20 py-2 rounded-xl text-xs font-bold hover:bg-main/40 transition-all active:scale-[0.98]">
                      {loading === 'pull' ? t('pulling') : t('pullFromCloud')}
                    </button>
                  </div>
                  <p className="text-[9px] text-textMuted/60 text-center font-medium">{t('encryptionNotice')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Master Password Card */}
          <div className="bg-sidebar border border-border/60 rounded-2xl p-5 space-y-5 flex flex-col shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-textMuted/80">{t('encryptionKey')}</h2>
            <div className="flex-1 flex flex-col justify-between gap-4">
              <p className="text-xs text-textMuted leading-relaxed">{t('encryptionKeyDesc')}</p>
              <div className="space-y-2.5">
                <input
                  type="password"
                  value={masterPassword}
                  onChange={e => setMasterPassword(e.target.value)}
                  placeholder={t('enterNewPassword')}
                  className="w-full bg-main/50 border border-border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all placeholder:text-textMuted/40"
                />
                <button
                  onClick={handleUpdateKey}
                  disabled={loading === 'updateKey'}
                  className="w-full bg-textMain text-main py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-all active:scale-[0.98] shadow-md shadow-black/10"
                >
                  {loading === 'updateKey' ? t('updating') : t('updateKey')}
                </button>
              </div>
            </div>
          </div>

          {/* Secret Storage Card */}
          <div className="bg-sidebar border border-border/60 rounded-2xl p-5 space-y-5 flex flex-col shadow-sm md:col-span-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-textMuted/80">{t('secretStorage')}</h2>
            <p className="text-xs text-textMuted leading-relaxed">{t('secretStorageDesc')}</p>
            <div className="flex bg-main/50 p-1 rounded-xl border border-border/50 gap-1">
              {(['file', 'keychain'] as SecretStorageType[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleStorageModeChange(mode)}
                  disabled={loading === 'storage'}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    settings.secretStorage === mode
                      ? 'bg-accent text-white shadow-md'
                      : 'text-textMuted hover:text-textMain hover:bg-hover/50'
                  }`}
                >
                  {mode === 'file' ? t('storageFile') : t('storageKeychain')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncSettings;
