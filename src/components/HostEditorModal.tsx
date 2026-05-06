import React, { useState, useEffect } from 'react';
import { X, Lock, TerminalSquare, Eye, EyeOff } from 'lucide-react';
import { useI18n } from '../I18nContext';
import { useHosts } from '../HostContext';
import { Host, CreateHostInput, ViewMode } from '../types';

interface HostEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect?: (hostOrId: string | Host, mode: ViewMode) => void;
  hostId?: string;
}

export const HostEditorModal: React.FC<HostEditorModalProps> = ({ isOpen, onClose, onConnect, hostId }) => {
  const { t } = useI18n();
  const { addHost, updateHost, getHost } = useHosts();
  const [isSaving, setIsSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'auth' | 'advanced'>('auth');
  const [authMethod, setAuthMethod] = useState<'password' | 'key'>('password');
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState<Partial<Host>>({
    name: '',
    address: '',
    port: 22,
    username: 'root',
    password: '',
    privateKeyPath: '~/.ssh/id_rsa',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setErrors({});
    setGlobalError(null);
    setShowPassword(false);
    if (hostId) {
      const host = getHost(hostId);
      if (host) {
        setFormData(host);
        setAuthMethod(host.authType === 'password' ? 'password' : 'key');
      }
    } else {
      setFormData({
        name: '',
        address: '',
        port: 22,
        username: 'root',
        password: '',
        privateKeyPath: '~/.ssh/id_rsa',
      });
      setAuthMethod('password');
    }
  }, [hostId, getHost, isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) newErrors.name = t('errorRequired');

    // IP/Domain Validation
    const address = formData.address?.trim() || '';
    const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const domainPattern = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;

    if (!address) {
      newErrors.address = t('errorRequired');
    } else {
      if (!ipv4Pattern.test(address) || !domainPattern.test(address)) {
        newErrors.address = t('errorInvalidHostname');
      }
    }

    if (!formData.port || formData.port < 1 || formData.port > 65535) {
      newErrors.port = t('errorInvalidPort');
    }

    if (!formData.username?.trim()) newErrors.username = t('errorRequired');

    if (authMethod === 'password' && !formData.password?.trim()) {
      newErrors.password = t('errorRequired');
    }

    if (authMethod === 'key' && !formData.privateKeyPath?.trim()) {
      newErrors.privateKeyPath = t('errorRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    setGlobalError(null);

    const input: CreateHostInput = {
      name: formData.name?.trim() || 'Unnamed Host',
      address: formData.address?.trim() || '',
      port: formData.port || 22,
      username: formData.username?.trim() || 'root',
      authType: authMethod,
      password: authMethod === 'password' ? formData.password : undefined,
      privateKeyPath: authMethod === 'key' ? formData.privateKeyPath : undefined,
      group: formData.group || 'Default',
      portForwards: formData.portForwards,
    };

    try {
      let savedHost: Host;
      if (hostId) {
        savedHost = await updateHost(hostId, input);
      } else {
        savedHost = await addHost(input);
      }
      onClose();

      if (onConnect && savedHost.id) {
        onConnect(savedHost, ViewMode.TERMINAL);
      }
    } catch (err: any) {
      console.error('Failed to save host:', err);
      setGlobalError(err.toString() || 'Failed to save host');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-sidebar border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-main">
          <h2 className="text-lg font-semibold text-textMain">{hostId ? t('editHost') : t('addHost')}</h2>
          <button onClick={onClose} className="text-textMuted hover:text-error transition-colors">
            <X size={20} />
          </button>
        </div>

        {globalError && (
          <div className="px-6 py-3 bg-error/10 border-b border-error/20 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
            <div className="w-5 h-5 rounded-full bg-error/20 flex items-center justify-center text-error shrink-0">
              <X size={12} strokeWidth={3} />
            </div>
            <p className="text-xs font-medium text-error flex-1">{globalError}</p>
            <button onClick={() => setGlobalError(null)} className="text-error/60 hover:text-error transition-colors">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex flex-1 min-h-[400px]">
          <div className="w-48 border-r border-border bg-main/50 p-4 flex flex-col gap-2">
            <button
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'auth' ? 'bg-hover text-accent' : 'text-textMuted hover:bg-hover/50 hover:text-textMain'}`}
              onClick={() => setActiveTab('auth')}
            >
              <Lock size={16} /> {t('auth')}
            </button>
            <button
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'advanced' ? 'bg-hover text-accent' : 'text-textMuted hover:bg-hover/50 hover:text-textMain'}`}
              onClick={() => setActiveTab('advanced')}
            >
              <TerminalSquare size={16} /> {t('advanced')}
            </button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div>
                <label className="block text-xs font-medium text-textMuted mb-1">{t('label')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full bg-main border rounded-md px-3 py-2 text-sm text-textMain focus:outline-none focus:border-accent transition-colors ${errors.name ? 'border-error' : 'border-border'}`}
                />
                {errors.name && <p className="mt-1 text-[10px] text-error">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-textMuted mb-1">{t('group')}</label>
                <input
                  type="text"
                  value={formData.group || 'Default'}
                  onChange={e => setFormData({ ...formData, group: e.target.value })}
                  className="w-full bg-main border border-border rounded-md px-3 py-2 text-sm text-textMain focus:outline-none focus:border-accent"
                />
              </div>
              <div className="col-span-2 flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-textMuted mb-1">{t('hostname')}</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className={`w-full bg-main border rounded-md px-3 py-2 text-sm text-textMain focus:outline-none focus:border-accent transition-colors ${errors.address ? 'border-error' : 'border-border'}`}
                  />
                  {errors.address && <p className="mt-1 text-[10px] text-error">{errors.address}</p>}
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-textMuted mb-1">{t('port')}</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className={`w-full bg-main border rounded-md px-3 py-2 text-sm text-textMain focus:outline-none focus:border-accent transition-colors ${errors.port ? 'border-error' : 'border-border'}`}
                  />
                  {errors.port && <p className="mt-1 text-[10px] text-error">{errors.port}</p>}
                </div>
              </div>
            </div>

            {activeTab === 'auth' && (
              <div className="space-y-6">
                <div className="flex gap-4 border-b border-border pb-2">
                  <button 
                    className={`text-sm pb-2 border-b-2 transition-colors ${authMethod === 'password' ? 'border-accent text-accent' : 'border-transparent text-textMuted hover:text-textMain'}`}
                    onClick={() => setAuthMethod('password')}
                  >
                    {t('password')}
                  </button>
                  <button 
                    className={`text-sm pb-2 border-b-2 transition-colors ${authMethod === 'key' ? 'border-accent text-accent' : 'border-transparent text-textMuted hover:text-textMain'}`}
                    onClick={() => setAuthMethod('key')}
                  >
                    {t('sshKey')}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-textMuted mb-1">{t('username')}</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    className={`w-full bg-main border rounded-md px-3 py-2 text-sm text-textMain focus:outline-none focus:border-accent transition-colors ${errors.username ? 'border-error' : 'border-border'}`}
                  />
                  {errors.username && <p className="mt-1 text-[10px] text-error">{errors.username}</p>}
                </div>

                {authMethod === 'key' ? (
                  <div>
                    <label className="block text-xs font-medium text-textMuted mb-1">{t('sshKey')}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.privateKeyPath || '~/.ssh/id_rsa'}
                        onChange={e => setFormData({ ...formData, privateKeyPath: e.target.value })}
                        className={`flex-1 bg-main border rounded-md px-3 py-2 text-sm text-textMain font-mono focus:outline-none focus:border-accent transition-colors ${errors.privateKeyPath ? 'border-error' : 'border-border'}`}
                        placeholder="~/.ssh/id_rsa"
                      />
                    </div>
                    {errors.privateKeyPath && <p className="mt-1 text-[10px] text-error">{errors.privateKeyPath}</p>}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-textMuted mb-1">{t('password')}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className={`w-full bg-main border rounded-md px-3 py-2 text-sm text-textMain focus:outline-none focus:border-accent transition-colors pr-10 ${errors.password ? 'border-error' : 'border-border'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-accent transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-[10px] text-error">{errors.password}</p>}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-textMuted mb-1">{t('startupSnippet')}</label>
                  <textarea
                    rows={3}
                    placeholder="Commands to run upon connection..."
                    className="w-full bg-main border border-border rounded-md px-3 py-2 text-sm text-textMain font-mono focus:outline-none focus:border-accent"
                  ></textarea>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-textMuted">{t('portForwarding')}</label>
                    <button
                      className="text-xs text-accent hover:underline"
                      onClick={() => setFormData({
                        ...formData,
                        portForwards: [...(formData.portForwards || []), { localPort: 8080, remoteAddress: '127.0.0.1', remotePort: 3306 }]
                      })}
                    >+ Add Rule</button>
                  </div>

                  <div className="space-y-3">
                    {(!formData.portForwards || formData.portForwards.length === 0) && (
                      <div className="text-center py-4 border border-dashed border-border rounded-md text-xs text-textMuted">
                        No port forwarding rules.
                      </div>
                    )}

                    {formData.portForwards?.map((rule, idx) => (
                      <div key={idx} className="bg-main border border-border rounded-md p-3 flex items-center justify-between group relative">
                        <button
                          onClick={() => {
                            const newRules = [...formData.portForwards!];
                            newRules.splice(idx, 1);
                            setFormData({ ...formData, portForwards: newRules });
                          }}
                          className="absolute -top-2 -right-2 bg-sidebar border border-border rounded-full p-1 text-textMuted hover:text-error hover:border-error opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={12} />
                        </button>

                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-textMuted mb-1">{t('local')}</span>
                          <input
                            type="number"
                            value={rule.localPort}
                            onChange={(e) => {
                              const newRules = [...formData.portForwards!];
                              newRules[idx].localPort = parseInt(e.target.value) || 0;
                              setFormData({ ...formData, portForwards: newRules });
                            }}
                            className="bg-hover px-2 py-1 rounded text-xs font-mono text-textMain w-20 text-center focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                        </div>

                        <div className="flex-1 flex flex-col items-center px-2">
                          <span className="text-[9px] text-success uppercase tracking-wider mb-1">{t('sshTunnel')}</span>
                          <div className="w-full h-[2px] bg-border relative">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-success shadow-[0_0_8px_var(--success)]"></div>
                            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-success/50 to-transparent"></div>
                          </div>
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-textMuted mb-1">{t('remote')}</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={rule.remoteAddress}
                              onChange={(e) => {
                                const newRules = [...formData.portForwards!];
                                newRules[idx].remoteAddress = e.target.value;
                                setFormData({ ...formData, portForwards: newRules });
                              }}
                              className="bg-hover px-2 py-1 rounded text-xs font-mono text-textMain w-28 text-center focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                            <span className="text-textMuted">:</span>
                            <input
                              type="number"
                              value={rule.remotePort}
                              onChange={(e) => {
                                const newRules = [...formData.portForwards!];
                                newRules[idx].remotePort = parseInt(e.target.value) || 0;
                                setFormData({ ...formData, portForwards: newRules });
                              }}
                              className="bg-hover px-2 py-1 rounded text-xs font-mono text-textMain w-16 text-center focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-main">
          <button onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm text-textMuted hover:text-textMain transition-colors disabled:opacity-50">{t('cancel')}</button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-2 px-4 py-2 text-sm bg-accent text-main font-bold rounded-md hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {isSaving ? (
              <>
                <div className="w-3 h-3 border-2 border-main/30 border-t-main rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              t('saveConnect')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
