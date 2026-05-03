import React, { useState, useEffect, useRef } from 'react';
import { Search, Server, Code, List, Settings, X, Command } from 'lucide-react';
import { useHosts } from '../HostContext';
import { useSnippets } from '../SnippetContext';
import { useI18n } from '../I18nContext';
import { ViewMode } from '../types';

interface GlobalSearchProps {
  onOpenSession: (hostId: string, mode: ViewMode) => void;
  onNavigate: (view: ViewMode) => void;
  onClose?: () => void;
}

interface SearchResult {
  type: 'host' | 'snippet' | 'view'
  id: string
  title: string
  subtitle: string
  icon: React.ReactNode
  action: () => void
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onOpenSession, onNavigate }) => {
  const { t } = useI18n();
  const { hosts } = useHosts();
  const { snippets } = useSnippets();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = React.useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const matches: SearchResult[] = [];

    // Search Hosts
    hosts.forEach(host => {
      if (host.name.toLowerCase().includes(lowerQuery) || host.address.includes(lowerQuery)) {
        matches.push({
          type: 'host',
          id: host.id,
          title: host.name,
          subtitle: host.address,
          icon: <Server size={14} />,
          action: () => onOpenSession(host.id, ViewMode.TERMINAL)
        });
      }
    });

    // Search Snippets
    snippets.forEach(snippet => {
      if (snippet.name.toLowerCase().includes(lowerQuery) || snippet.command.toLowerCase().includes(lowerQuery)) {
        matches.push({
          type: 'snippet',
          id: snippet.id,
          title: snippet.name,
          subtitle: snippet.command,
          icon: <Code size={14} />,
          action: () => {
            onNavigate(ViewMode.SNIPPETS);
            // Optionally auto-run or filter? For now just navigate.
          }
        });
      }
    });

    // Search Views
    const views = [
      { id: ViewMode.HOST_LIST, title: t('hostList'), icon: <List size={14} /> },
      { id: ViewMode.SNIPPETS, title: t('snippets'), icon: <Code size={14} /> },
      { id: ViewMode.SETTINGS, title: t('settings'), icon: <Settings size={14} /> },
    ];

    views.forEach(view => {
      if (view.title.toLowerCase().includes(lowerQuery)) {
        matches.push({
          type: 'view',
          id: view.id,
          title: view.title,
          subtitle: 'Navigation',
          icon: view.icon,
          action: () => onNavigate(view.id as ViewMode)
        });
      }
    });

    return matches.slice(0, 10);
  }, [query, hosts, snippets, t, onOpenSession, onNavigate]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      if (results[selectedIndex]) {
        results[selectedIndex].action();
        setIsOpen(false);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-48 mr-4 shrink-0" ref={containerRef}>
      <div
        className={`flex items-center bg-main border transition-all duration-200 rounded-md px-1 py-1.5 text-xs group ${isOpen ? 'border-accent ring-2 ring-accent/10 shadow-sm' : 'border-border hover:border-hoverDark'
          }`}
      >
        <Search size={14} className={`mr-1 transition-colors ${isOpen ? 'text-accent' : 'text-textMuted'}`} />
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-textMain placeholder-textMuted text-xs"
          placeholder={t('search')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {!query && (
          <kbd className="hidden sm:flex items-center gap-0.5 px-0.5 py-0.5 rounded text-[10px] font-medium bg-hover border border-border/50 ml-1.5 text-textMuted shrink-0 h-4.5">
            <span className="text-[14px] leading-none translate-y-[-1px]">⌘</span>
            <span className="text-[12px] leading-none">K</span>
          </kbd>
        )}
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="text-textMuted hover:text-textMain p-0.5"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-sidebar border border-border rounded-lg shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="p-1">
            {results.map((result, idx) => (
              <div
                key={`${result.type}-${result.id}`}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-md transition-colors ${idx === selectedIndex ? 'bg-accent text-main' : 'hover:bg-hover'
                  }`}
                onClick={() => {
                  result.action();
                  setIsOpen(false);
                  setQuery('');
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className={`${idx === selectedIndex ? 'text-main' : 'text-textMuted'} shrink-0`}>
                  {result.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${idx === selectedIndex ? 'text-main' : 'text-textMain'}`}>
                    {result.title}
                  </div>
                  <div className={`text-[10px] truncate opacity-70 ${idx === selectedIndex ? 'text-main' : 'text-textMuted'}`}>
                    {result.subtitle}
                  </div>
                </div>
                {idx === selectedIndex && (
                  <Command size={10} className="text-main/50" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results Placeholder */}
      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-sidebar border border-border rounded-lg shadow-2xl p-4 text-center z-50 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-xs text-textMuted">No results found for "{query}"</p>
        </div>
      )}
    </div>
  );
};
