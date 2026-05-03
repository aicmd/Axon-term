import React, { useState } from 'react';
import { Server, Plus, Search, MoreVertical, Terminal, Folder, Edit2, Trash2, Filter, LayoutList, LayoutGrid, Globe } from 'lucide-react';
import { useHosts } from '../HostContext';
import { Host, ConnectionState, ViewMode, Tab } from '../types';
import { useI18n } from '../I18nContext';
import { getStatusColor } from '../utils/statusUtils';
import { UbuntuLogo, DebianLogo, CentOSLogo, RedHatLogo, AppleLogo, WindowsLogo, RaspberryPiLogo } from './icons/OsLogo';

interface HostListViewProps {
  onConnect: (hostId: string, mode: ViewMode) => void;
  onEdit: (hostId: string) => void;
  onAdd: () => void;
  tabs: Tab[];
}

type DisplayMode = 'table' | 'card';

export const HostListView: React.FC<HostListViewProps> = ({ onConnect, onEdit, onAdd, tabs }) => {
  const { t } = useI18n();
  const { hosts, deleteHost } = useHosts();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    const saved = localStorage.getItem('axon-host-display-mode');
    return (saved as DisplayMode) || 'table';
  });
  const [hostToDelete, setHostToDelete] = useState<{ id: string, name: string } | null>(null);

  const getHostIcon = (host: Host) => {
    const os = (host.os || '').toLowerCase();
    const name = host.name.toLowerCase();

    if (os.includes('linux')) {
      if (os.includes('ubuntu')) {
        return <UbuntuLogo size={18} color="orange" />;
      }
      if (os.includes('debian')) {
        return <DebianLogo size={18} color="red" />;
      }

      if (os.includes('centos')) {
        return <CentOSLogo size={18} color="white" />;
      }
      if (os.includes('redhat')) {
        return <RedHatLogo size={18} color="white" />;
      }
      if (os.includes('raspberrypi')) {
        return <RaspberryPiLogo size={18} color="white" />;
      }
    }

    // MacOS / Darwin
    if (
      os.includes('mac') ||
      os.includes('darwin') ||
      os.includes('osx') ||
      name.includes('macbook') ||
      name.includes('apple') ||
      name.includes('imac')
    ) {
      return <AppleLogo size={18} color="white" />;
    }

    // Windows
    if (
      os.includes('windows') ||
      os.includes('win32') ||
      os.includes('win64') ||
      name.includes('windows') ||
      name.includes('win-')
    ) {
      return <WindowsLogo size={18} color="white" />;
    }

    // Default fallback
    return <Server size={18} />;
  };

  const handleDisplayModeChange = (mode: DisplayMode) => {
    setDisplayMode(mode);
    localStorage.setItem('axon-host-display-mode', mode);
  };

  const groups = ['All', ...new Set(hosts.map(h => h.group).filter(Boolean))];

  const filteredHosts = hosts.filter(host => {
    const matchesSearch = host.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      host.address.includes(searchQuery);
    const matchesGroup = selectedGroup === 'All' || host.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const hostsWithState = filteredHosts.map(host => {
    const activeTab = tabs.find(t => t.hostId === host.id);
    return {
      ...host,
      state: activeTab ? activeTab.state : ConnectionState.DISCONNECTED,
      hasTab: !!activeTab
    };
  });


  const handleDelete = (id: string, name: string) => {
    setHostToDelete({ id, name });
  };

  return (
    <div className="flex-1 flex flex-col bg-main overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border bg-sidebar/20 shrink-0">
        <div className="flex items-center justify-between gap-4">
          {/* Left Side: Search & Filter */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative w-full sm:max-w-[230px]  shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={14} />
              <input
                type="text"
                placeholder={t('searchHosts')}
                className="w-full bg-sidebar border border-border rounded-md pl-9 pr-16 py-1.5 text-sm text-textMain focus:outline-none focus:border-accent transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 bg-hover rounded border border-border text-textMuted font-medium">
                {hosts.length}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-sidebar border border-border rounded-md px-2 py-1.5 shrink-0">
              <Filter size={14} className="text-textMuted" />
              <select
                className="bg-transparent text-sm text-textMain focus:outline-none appearance-none cursor-pointer pr-4"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                {groups.map(group => (
                  <option key={group} value={group}>{group === 'All' ? t('allHosts') : group}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Side: View Toggle & Add Button */}
          <div className="flex items-center gap-3 shrink-0">
            {/* View Toggle */}
            <div className="flex bg-sidebar border border-border rounded-md p-0.5 shrink-0">
              <button
                onClick={() => handleDisplayModeChange('table')}
                className={`p-1 rounded transition-all ${displayMode === 'table' ? 'bg-accent text-main shadow-sm' : 'text-textMuted hover:text-textMain'}`}
                title={t('tableView')}
              >
                <LayoutList size={16} />
              </button>
              <button
                onClick={() => handleDisplayModeChange('card')}
                className={`p-1 rounded transition-all ${displayMode === 'card' ? 'bg-accent text-main shadow-sm' : 'text-textMuted hover:text-textMain'}`}
                title={t('cardView')}
              >
                <LayoutGrid size={16} />
              </button>
            </div>

            <div className="w-px h-4 bg-border mx-1 hidden sm:block"></div>

            <button
              onClick={onAdd}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-accent text-main text-sm font-medium rounded-md hover:bg-accent/90 transition-colors shadow-sm shrink-0"
            >
              <Plus size={16} />
              {t('addHost')}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {displayMode === 'table' ? (
          <>
            {/* Table Header */}
            <div className="shrink-0 bg-sidebar/40 border-b border-border z-10 shadow-sm">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="text-xs text-textMuted uppercase tracking-wider">
                    <th className="px-6 py-3 font-semibold w-[25%] sm:w-[20%]">{t('label')}</th>
                    <th className="px-6 py-3 font-semibold hidden lg:table-cell w-[15%]">{t('group')}</th>
                    <th className="px-6 py-3 font-semibold hidden sm:table-cell w-[20%]">{t('hostname')}</th>
                    <th className="py-3 font-semibold  w-[30px] text-center">{t('status')}</th>
                    <th className="px-2 py-3 font-semibold text-center w-[120px]">{t('actions')}</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Table Body - Scrollable Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <table className="w-full text-left border-collapse table-fixed">
                <tbody className="divide-y divide-border">
                  {hostsWithState.map((host) => (
                    <tr key={host.id} className="hover:bg-hover transition-colors group">
                      <td className="px-6 py-4 truncate w-[25%] sm:w-[20%]">
                        <div className="flex items-center gap-3 ">
                          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                            {getHostIcon(host)}
                          </div>
                          <span className="font-medium text-textMain truncate">{host.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell truncate w-[15%]">
                        <span className="px-2 py-1 rounded-md bg-hover text-xs text-textMuted border border-border truncate max-w-[100px] inline-block">
                          {host.group}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-textMuted hidden sm:table-cell truncate w-[20%]">
                        {host.address}
                      </td>
                      <td className="py-4 w-[30px]">
                        <div className="flex items-center justify-center">
                          <div className={`w-2 h-2 rounded-full shrink-0 ring-4 ring-transparent group-hover:ring-accent/10 transition-all ${getStatusColor(host.state as ConnectionState, host.hasTab)}`}></div>
                        </div>
                      </td>
                      <td className="px-2 py-4 w-[120px]">
                        <div className="flex items-center justify-end gap-2 pr-4">
                          <button
                            onClick={() => onConnect(host.id, ViewMode.TERMINAL)}
                            className="p-1 text-textMuted hover:text-success hover:bg-success/10 rounded-lg transition-all"
                            title={t('connect')}
                          >
                            <Terminal size={16} />
                          </button>
                          <button
                            onClick={() => onConnect(host.id, ViewMode.SFTP)}
                            className="p-1 text-textMuted hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                            title={t('sftp')}
                          >
                            <Folder size={16} />
                          </button>

                          <button
                            onClick={() => onEdit(host.id)}
                            className="p-1 text-textMuted hover:text-textMain hover:bg-hover rounded-lg transition-all"
                            title={t('edit')}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(host.id, host.name)}
                            className="p-1 text-textMuted hover:text-error hover:bg-error/10 rounded-lg transition-all"
                            title={t('delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* Card View */
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 p-4">
              {hostsWithState.map((host) => (
                <div
                  key={host.id}
                  className="bg-sidebar border border-border rounded-xl p-4 hover:border-accent/50 transition-all group shadow-sm hover:shadow-md flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                        {getHostIcon(host)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-textMain truncate max-w-[110px]">{host.name}</h3>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(host.state as ConnectionState, host.hasTab)}`}></div>
                          <span className="text-[10px] text-textMuted uppercase tracking-wider">{host.state || 'DISCONNECTED'}</span>
                        </div>
                      </div>
                    </div>
                    <button className="p-1 text-textMuted hover:text-textMain rounded-md hover:bg-hover transition-colors">
                      <MoreVertical size={14} />
                    </button>
                  </div>

                  <div className="space-y-2 mb-4 flex-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-textMuted flex items-center gap-1"><Globe size={10} /> IP</span>
                      <span className="text-textMain font-mono opacity-80">{host.address}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-textMuted">{t('group')}</span>
                      <span className="px-1.5 py-0.5 rounded bg-hover text-textMuted border border-border text-[10px]">{host.group}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <button
                      onClick={() => onConnect(host.id, ViewMode.TERMINAL)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-hover hover:bg-success hover:text-main rounded-lg text-[11px] font-medium transition-all"
                    >
                      <Terminal size={14} />
                      {t('connect')}
                    </button>
                    <button
                      onClick={() => onConnect(host.id, ViewMode.SFTP)}
                      className="p-1.5 bg-hover hover:bg-accent hover:text-main rounded-lg transition-all"
                      title={t('sftp')}
                    >
                      <Folder size={14} />
                    </button>
                    <button
                      onClick={() => onEdit(host.id)}
                      className="p-1.5 bg-hover hover:bg-hoverDark text-textMain rounded-lg transition-all"
                      title={t('edit')}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(host.id, host.name)}
                      className="p-1.5 bg-hover hover:bg-error hover:text-main text-error rounded-lg transition-all"
                      title={t('delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hostsWithState.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-textMuted">
            <Server size={64} className="opacity-10 mb-4" />
            <p className="text-lg font-medium">No hosts found</p>
            <p className="text-sm opacity-60">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {hostToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-sidebar border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-textMain mb-2">{t('confirmDeleteHost')}</h3>
            <p className="text-sm text-textMuted mb-6">
              {t('deletedWarning')} <span className="text-textMain font-medium font-mono bg-hover px-1 rounded">{hostToDelete.name}</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setHostToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-textMuted hover:text-textMain transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  deleteHost(hostToDelete.id);
                  setHostToDelete(null);
                }}
                className="px-4 py-2 bg-error text-main text-sm font-medium rounded-lg hover:bg-error/90 transition-colors shadow-lg shadow-error/20"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
