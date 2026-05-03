import React, { useState, useEffect } from 'react';
import { X, Code, Tag, AlignLeft, Terminal as TerminalIcon } from 'lucide-react';
import { useI18n } from '../I18nContext';
import { useSnippets } from '../SnippetContext';
import { Snippet } from '../types';

interface SnippetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippet?: Snippet | null;
}

export const SnippetEditorModal: React.FC<SnippetEditorModalProps> = ({ isOpen, onClose, snippet }) => {
  const { t } = useI18n();
  const { addSnippet, updateSnippet } = useSnippets();
  const [formData, setFormData] = useState({
    name: '',
    command: '',
    category: 'System',
    description: ''
  });
  const [errors, setErrors] = useState<{name?: string, command?: string}>({});

  useEffect(() => {
    if (snippet) {
      setFormData({
        name: snippet.name,
        command: snippet.command,
        category: snippet.category || 'System',
        description: snippet.description || ''
      });
    } else {
      setFormData({ name: '', command: '', category: 'System', description: '' });
    }
    setErrors({});
  }, [snippet, isOpen]);

  const validate = () => {
    const newErrors: {name?: string, command?: string} = {};
    if (!formData.name.trim()) newErrors.name = t('errorRequired');
    if (!formData.command.trim()) newErrors.command = t('errorRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    if (snippet) {
      updateSnippet(snippet.id, formData);
    } else {
      addSnippet(formData);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-xl bg-sidebar border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-main">
          <h2 className="text-lg font-bold text-textMain">
            {snippet ? t('editSnippet') : t('addSnippet')}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-textMuted hover:bg-error/10 hover:text-error transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-textMuted uppercase tracking-widest flex items-center gap-2">
                  <Code size={14} className="text-accent" /> {t('name')}
                </label>
                {errors.name && <span className="text-[9px] font-black text-error uppercase tracking-tighter animate-in fade-in slide-in-from-right-2">{errors.name}</span>}
              </div>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => {
                  setFormData({...formData, name: e.target.value});
                  if (errors.name) setErrors({...errors, name: undefined});
                }}
                className={`w-full bg-main border rounded-xl px-4 py-2.5 text-sm text-textMain focus:outline-none transition-all focus:ring-2 ${
                  errors.name ? 'border-error/50 ring-error/10' : 'border-border focus:border-accent focus:ring-accent/10'
                }`} 
                placeholder={t('namePlaceholder')}
                autoFocus
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-bold text-textMuted uppercase tracking-widest mb-2 flex items-center gap-2">
                <Tag size={14} className="text-accent" /> {t('category')}
              </label>
              <div className="relative">
                <select 
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full bg-main border border-border rounded-xl px-4 py-2.5 text-sm text-textMain focus:outline-none focus:border-accent appearance-none transition-all focus:ring-2 focus:ring-accent/10"
                >
                  <option value="System">System</option>
                  <option value="Docker">Docker</option>
                  <option value="Network">Network</option>
                  <option value="Database">Database</option>
                  <option value="DevOps">DevOps</option>
                  <option value="Git">Git</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted">
                  <X size={12} className="rotate-45" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-textMuted uppercase tracking-widest mb-2 flex items-center gap-2">
              <AlignLeft size={14} className="text-accent" /> {t('description')}
            </label>
            <input 
              type="text" 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full bg-main border border-border rounded-xl px-4 py-2.5 text-sm text-textMain focus:outline-none focus:border-accent transition-all focus:ring-2 focus:ring-accent/10" 
              placeholder={t('descPlaceholder')}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-textMuted uppercase tracking-widest flex items-center gap-2">
                <TerminalIcon size={14} className="text-accent" /> {t('command')}
              </label>
              {errors.command && <span className="text-[9px] font-black text-error uppercase tracking-tighter animate-in fade-in slide-in-from-right-2">{errors.command}</span>}
            </div>
            <div className="relative">
              <textarea 
                rows={5} 
                value={formData.command}
                onChange={e => {
                  setFormData({...formData, command: e.target.value});
                  if (errors.command) setErrors({...errors, command: undefined});
                }}
                className={`w-full bg-terminal border rounded-xl px-4 py-3 text-sm text-textMain font-mono focus:outline-none transition-all focus:ring-2 leading-relaxed shadow-inner ${
                  errors.command ? 'border-error/50 ring-error/10' : 'border-border focus:border-accent focus:ring-accent/10'
                }`}
                placeholder={t('commandPlaceholder')}
              ></textarea>
              <div className="absolute bottom-3 right-3 text-[10px] text-textMuted font-mono opacity-40">
                SHELL
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-border bg-main/50">
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 text-sm font-bold text-textMuted hover:text-textMain transition-all active:scale-95"
          >
            {t('cancel')}
          </button>
          <button 
            onClick={handleSave} 
            className="px-8 py-2.5 text-sm bg-accent text-main font-bold rounded-xl hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 active:scale-95"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};
