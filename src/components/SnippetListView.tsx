import React, { useState } from 'react';
import { TerminalSquare, Plus, Search, Copy, Edit2, Trash2, Filter, Code, Tag, LayoutList, LayoutGrid, Check } from 'lucide-react';
import { useI18n } from '../I18nContext';
import { useSnippets } from '../SnippetContext';
import { SnippetEditorModal } from './SnippetEditorModal';
import { Snippet } from '../types';

type DisplayMode = 'grid' | 'list';

interface SnippetListViewProps {}

export const SnippetListView: React.FC<SnippetListViewProps> = () => {
  const { t } = useI18n();
  const { snippets, deleteSnippet } = useSnippets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    const saved = localStorage.getItem('axon-snippet-display-mode');
    return (saved as DisplayMode) || 'grid';
  });
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDisplayModeChange = (mode: DisplayMode) => {
    setDisplayMode(mode);
    localStorage.setItem('axon-snippet-display-mode', mode);
  };

  const categories = ['All', ...new Set(snippets.map(s => s.category).filter(Boolean))];

  const filteredSnippets = snippets.filter(snippet => {
    const matchesSearch = snippet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (snippet.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || snippet.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCopy = async (id: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = command;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (e) { }
      document.body.removeChild(textArea);
    }
  };

  const handleEdit = (snippet: Snippet) => {
    setEditingSnippet(snippet);
    setIsEditorOpen(true);
  };

  const handleAdd = () => {
    setEditingSnippet(null);
    setIsEditorOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteSnippet(id);
    setConfirmDeleteId(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-main overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border bg-sidebar/20 shrink-0">
        <div className="flex items-center justify-between gap-4">
          {/* Left Side: Search & Filter */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative w-full max-w-[230px] shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={14} />
              <input
                type="text"
                placeholder={t('searchSnippets')}
                className="w-full bg-sidebar border border-border rounded-md pl-9 pr-16 py-1.5 text-sm text-textMain focus:outline-none focus:border-accent transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 bg-hover rounded border border-border text-textMuted font-medium">
                {snippets.length}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-sidebar border border-border rounded-md px-2 py-1.5 shrink-0">
              <Filter size={14} className="text-textMuted" />
              <select
                className="bg-transparent text-sm text-textMain focus:outline-none appearance-none cursor-pointer pr-4"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat === 'All' ? t('allSnippets') : cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Side: View Toggle & Add Button */}
          <div className="flex items-center gap-3 shrink-0">
            {/* View Toggle */}
            <div className="flex bg-sidebar border border-border rounded-md p-0.5 shrink-0">
              <button
                onClick={() => handleDisplayModeChange('list')}
                className={`p-1 rounded transition-all ${displayMode === 'list' ? 'bg-accent text-main shadow-sm' : 'text-textMuted hover:text-textMain'}`}
                title={t('tableView')}
              >
                <LayoutList size={16} />
              </button>
              <button
                onClick={() => handleDisplayModeChange('grid')}
                className={`p-1 rounded transition-all ${displayMode === 'grid' ? 'bg-accent text-main shadow-sm' : 'text-textMuted hover:text-textMain'}`}
                title={t('cardView')}
              >
                <LayoutGrid size={16} />
              </button>
            </div>

            <div className="w-px h-4 bg-border mx-1 hidden sm:block"></div>

            <button
              onClick={handleAdd}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-accent text-main text-sm font-medium rounded-md hover:bg-accent/90 transition-colors shadow-sm shrink-0"
            >
              <Plus size={16} />
              {t('addSnippet')}
            </button>
          </div>
        </div>
      </div>

      {/* Snippet Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {displayMode === 'grid' ? (
          <div className="flex-1 overflow-y-auto p-4 bg-main/30">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {filteredSnippets.map((snippet) => (
                <div
                  key={snippet.id}
                  className=" bg-sidebar border border-border rounded-xl p-4  hover:border-accent/40 transition-all group shadow-sm hover:shadow-lg flex flex-col relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-3 relative z-10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-main transition-all duration-300">
                        <Code size={16} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-textMain truncate max-w-[130px] group-hover:text-accent transition-colors">{snippet.name}</h3>
                        <div className="flex items-center gap-1.5">
                          <Tag size={10} className="text-textMuted" />
                          <span className="text-[10px] text-textMuted uppercase tracking-widest font-medium">{snippet.category || 'General'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(snippet.id, snippet.command)}
                        className={`p-1.5 rounded-lg transition-all ${copiedId === snippet.id ? 'text-success bg-success/10' : 'text-textMuted hover:text-textMain hover:bg-hover'}`}
                        title={t('copy')}
                      >
                        {copiedId === snippet.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button
                        onClick={() => handleEdit(snippet)}
                        className="p-1.5 text-textMuted hover:text-textMain rounded-lg hover:bg-hover transition-all"
                        title={t('edit')}
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-textMuted mb-3 line-clamp-2 h-7 leading-relaxed relative z-10 px-0.5">
                    {snippet.description || 'No description provided.'}
                  </div>

                  <div className="bg-main/50 border border-border rounded-lg p-2.5 mb-3 flex-1 font-mono text-[10px] text-textMuted overflow-hidden group-hover:border-accent/20 transition-all shadow-inner relative">
                    <div className="line-clamp-2 break-all font-mono leading-normal opacity-80">
                      {snippet.command}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 relative z-10">
                    <button
                      onClick={() => setConfirmDeleteId(snippet.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-hover text-textMuted hover:text-error hover:bg-error/10 rounded-lg transition-all active:scale-[0.98]"
                      title={t('delete')}
                    >
                      <Trash2 size={16} />
                      <span className="text-[11px] font-bold">{t('delete')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-main/10">
            {/* Table Header */}
            <div className="shrink-0 bg-sidebar/40 border-b border-border z-10 shadow-sm">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="text-xs text-textMuted uppercase tracking-wider">
                    <th className="px-6 py-3 font-semibold w-[30%] sm:w-[25%]">{t('name')}</th>
                    <th className="px-6 py-3 font-semibold hidden lg:table-cell w-[15%]">{t('category')}</th>
                    <th className="px-6 py-3 font-semibold hidden sm:table-cell w-[35%]">{t('command')}</th>
                    <th className="px-2 py-3 font-semibold text-center w-[180px]">{t('actions')}</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Table Body - Scrollable Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <table className="w-full text-left border-collapse table-fixed">
                <tbody className="divide-y divide-border">
                  {filteredSnippets.map((snippet) => (
                    <tr key={snippet.id} className="hover:bg-hover transition-colors group">
                      <td className="px-6 py-4 truncate w-[30%] sm:w-[25%]">
                        <div className="flex items-center gap-3 truncate">
                          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
                            <Code size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-textMain truncate">{snippet.name}</div>
                            <div className="text-[10px] text-textMuted truncate mt-0.5">{snippet.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell truncate w-[15%]">
                        <span className="px-2 py-1 rounded-md bg-hover text-xs text-textMuted border border-border truncate max-w-[100px] inline-block uppercase tracking-wider">
                          {snippet.category || 'General'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-textMuted hidden sm:table-cell truncate w-[35%]">
                        <div className="bg-main/30 px-2 py-1 rounded border border-border/50 truncate">
                          {snippet.command}
                        </div>
                      </td>
                      <td className="px-2 py-4 w-[180px]">
                        <div className="flex items-center justify-end gap-1.5 pr-4">
                          <button
                            onClick={() => handleCopy(snippet.id, snippet.command)}
                            className={`p-1.5 rounded-lg transition-all ${copiedId === snippet.id ? 'text-success bg-success/10' : 'text-textMuted hover:text-textMain hover:bg-hover'}`}
                            title={t('copy')}
                          >
                            {copiedId === snippet.id ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                          <div className="w-px h-4 bg-border mx-0.5"></div>
                          <button
                            onClick={() => handleEdit(snippet)}
                            className="p-1.5 text-textMuted hover:text-textMain hover:bg-hover rounded-lg transition-all"
                            title={t('edit')}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(snippet.id)}
                            className="p-1.5 text-textMuted hover:text-error hover:bg-error/10 rounded-lg transition-all"
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
          </div>
        )}

        {filteredSnippets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-textMuted">
            <div className="w-20 h-20 rounded-full bg-sidebar flex items-center justify-center mb-6 shadow-inner border border-border">
              <TerminalSquare size={40} className="opacity-20" />
            </div>
            <p className="text-lg font-bold text-textMain/60">No snippets found</p>
            <p className="text-sm opacity-60 max-w-xs text-center mt-2">Try adjusting your search or filters to find what you're looking for.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-sidebar border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-textMain mb-2">{t('confirmDeleteSnippet')}</h3>
            <p className="text-sm text-textMuted mb-6">
              {t('deleteSnippetWarning')} <span className="text-textMain font-medium font-mono bg-hover px-1 rounded">{snippets.find(s => s.id === confirmDeleteId)?.name}</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-textMuted hover:text-textMain transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                className="px-4 py-2 bg-error text-main text-sm font-medium rounded-lg hover:bg-error/90 transition-colors shadow-lg shadow-error/20"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <SnippetEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        snippet={editingSnippet}
      />
    </div>
  );
};
