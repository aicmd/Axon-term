import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { Folder, File, ChevronRight, Home, RefreshCw, MoreVertical, ArrowRightLeft, Trash2, Loader2 } from 'lucide-react';
import { useI18n } from '../../I18nContext';
import { SftpEntry } from '../../types';
import { FilePaneProps, formatBytes, activeDragPayload, setActiveDragPayload } from './types';

export const FilePane: React.FC<FilePaneProps> = ({
  paneId, title, icon, path, files, selectedFile, onSelect, onFileDrop, onNavigate, onRefresh, onGoHome, onDelete, menuActions, isLoading
}) => {
  const { t } = useI18n();
  const [isDragOver, setIsOver] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleDragStart = useCallback((e: React.DragEvent, file: SftpEntry) => {
    // Store payload in module-level variable (WebKit-safe)
    setActiveDragPayload({ file, sourcePaneId: paneId });
    // Still set dataTransfer so the browser shows a drag ghost
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', file.name);
  }, [paneId]);

  const handleDragEnd = useCallback(() => {
    // Clean up if the drag was cancelled (escaped / dropped outside)
    setActiveDragPayload(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsOver(true);
  }, [isDragOver]);

  // Only reset isDragOver when the cursor truly leaves the pane element,
  // not when moving between its child elements (table rows, cells, etc.).
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as Node | null;
    if (paneRef.current && relatedTarget && paneRef.current.contains(relatedTarget)) {
      return; // Still inside the pane – ignore the event
    }
    setIsOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);

    // Read from the module-level variable instead of dataTransfer
    const payload = activeDragPayload;
    setActiveDragPayload(null);

    if (payload && payload.sourcePaneId !== paneId) {
      onFileDrop(payload.file, payload.sourcePaneId);
    }
  }, [paneId, onFileDrop]);

  const handleDoubleClick = useCallback((file: SftpEntry) => {
    if (file.kind === 'directory' || file.kind === 'symlink') {
      onNavigate(file.path);
    }
  }, [onNavigate]);

  const handleGoUp = useCallback(() => {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return;
    const isAbsolute = path.startsWith('/');
    const newPath = (isAbsolute ? '/' : '') + segments.slice(0, -1).join('/');
    onNavigate(newPath || '/');
  }, [path, onNavigate]);

  const handleBreadcrumbClick = useCallback((index: number) => {
    const segments = path.split('/').filter(Boolean);
    const isAbsolute = path.startsWith('/');
    const targetSegments = segments.slice(0, index + 1);
    const newPath = (isAbsolute ? '/' : '') + targetSegments.join('/');
    onNavigate(newPath);
  }, [path, onNavigate]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedFile) onDelete(selectedFile);
  }, [selectedFile, onDelete]);

  const virtuosoComponents = useMemo(() => ({
    Table: (props: any) => <table {...props} className="w-full text-left text-sm select-none border-separate border-spacing-0 table-fixed" />,
    TableHead: React.forwardRef<HTMLTableSectionElement, any>((props, ref) => (
      <thead {...props} ref={ref} className="sticky top-0 bg-main text-[10px] text-textMuted uppercase tracking-wider border-b border-border z-10" />
    )),
    TableBody: React.forwardRef<HTMLTableSectionElement, any>((props, ref) => (
      <tbody {...props} ref={ref}>
        <tr className="hover:bg-hover/50 cursor-pointer group" onDoubleClick={handleGoUp}>
          <td className="px-4 py-1.5 flex items-center gap-2 text-textMain/80 font-medium italic"><Folder size={16} className="text-accent/60" />..</td>
          <td className="px-4 py-1.5 text-textMuted text-xs">--</td>
          <td className="px-4 py-1.5 text-textMuted text-xs hidden lg:table-cell">{t('parent')}</td>
        </tr>
        {props.children}
      </tbody>
    )),
    TableRow: ({ item, context, ...props }: any) => {
      const file = item as SftpEntry;
      if (!file) return <tr {...props} />;
      const isSelected = context.selectedFile?.path === file.path;
      return (
        <tr
          {...props}
          draggable
          onDragStart={(e) => context.handleDragStart(e, file)}
          onDragEnd={context.handleDragEnd}
          onDoubleClick={() => context.handleDoubleClick(file)}
          onClick={() => context.onSelect(file)}
          className={`cursor-pointer border-b border-border/10 transition-colors ${isSelected ? 'bg-accent/10 border-accent/20' : 'hover:bg-hover/40'}`}
        />
      );
    }
  }), [handleGoUp, t]);

  return (
    <div
      ref={paneRef}
      className={`flex-1 flex flex-col min-w-0 bg-main transition-all duration-200 relative ${isDragOver ? 'bg-accent/5 z-30' : 'z-0'
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 border-2 border-accent z-[100] pointer-events-none rounded-sm"></div>
      )}
      {isDragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="bg-accent text-main px-4 py-2 rounded-full shadow-xl flex items-center gap-2 font-bold animate-bounce">
            <ArrowRightLeft size={18} />
            {paneId === 'remote' ? t('dropToUpload') : t('dropToDownload')}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-textMain">{icon}<span>{title}</span></div>
        <div className="flex items-center gap-1">
          <button onClick={onGoHome} className="p-1.5 text-textMuted hover:text-textMain hover:bg-hover rounded transition-colors" title="Home"><Home size={14} /></button>
          <button onClick={onRefresh} className="p-1.5 text-textMuted hover:text-textMain hover:bg-hover rounded transition-colors" title={t('refresh')}><RefreshCw size={14} /></button>
          <button
            onClick={handleDelete}
            disabled={!selectedFile}
            className={`p-1.5 rounded transition-colors ${!selectedFile ? 'text-textMuted/30 cursor-not-allowed' : 'text-error/70 hover:text-error hover:bg-error/10'}`}
            title={t('delete')}
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-1.5 rounded transition-colors ${isMenuOpen ? 'bg-accent/10 text-accent' : 'text-textMuted hover:text-textMain hover:bg-hover'}`}
          >
            <MoreVertical size={14} />
          </button>

          {isMenuOpen && menuActions && (
            <div
              ref={menuRef}
              className="absolute right-4 top-10 w-48 bg-sidebar border border-border rounded-lg shadow-2xl z-[60] py-1 animate-in fade-in zoom-in-95 duration-100"
            >
              {menuActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => {
                    action.onClick();
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${action.danger ? 'text-error hover:bg-error/10' : 'text-textMain hover:bg-hover'}`}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center px-4 py-2 border-b border-border bg-main text-xs text-textMuted overflow-x-auto whitespace-nowrap no-scrollbar shrink-0">
        <span className="hover:text-textMain cursor-pointer transition-colors" onClick={() => onNavigate('/')}>/</span>
        {path.split('/').filter(Boolean).map((segment, i, _arr) => (
          <React.Fragment key={i}>
            <ChevronRight size={12} className="mx-0.5 opacity-50" />
            <span className="hover:text-textMain cursor-pointer transition-colors" onClick={() => handleBreadcrumbClick(i)}>{segment}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto relative min-h-0">
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-main/60 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3 animate-in fade-in duration-300">
            <Loader2 size={24} className="text-accent animate-spin" />
            <span className="text-[10px] text-textMuted uppercase tracking-widest font-bold animate-pulse">{t('connecting')}</span>
          </div>
        )}
        <TableVirtuoso
          style={{ height: '100%', width: '100%', overflowX: 'hidden' }}
          data={files}
          components={virtuosoComponents}
          context={{ selectedFile, handleDragStart, handleDragEnd, handleDoubleClick, onSelect }}
          fixedHeaderContent={() => (
            <tr>
              <th className="px-4 py-2 font-medium border-b border-border bg-main/95 backdrop-blur-sm">{t('name')}</th>
              <th className="px-4 py-2 font-medium w-24 border-b border-border bg-main/95 backdrop-blur-sm">{t('size')}</th>
              <th className="px-4 py-2 font-medium w-32 hidden lg:table-cell border-b border-border bg-main/95 backdrop-blur-sm">{t('kind')}</th>
            </tr>
          )}
          itemContent={(_index, file) => (
            <>
              <td className="px-4 py-1.5 text-textMain overflow-hidden">
                <div className="flex items-center gap-2 min-w-0">
                  {file.kind === 'directory' ? (
                    <Folder size={16} className="text-accent" fill="currentColor" fillOpacity={0.2} />
                  ) : (
                    <File size={16} className="text-textMuted/60" />
                  )}
                  <span className="truncate flex-1" title={file.name}>
                    {file.name}
                  </span>
                </div>
              </td>
              <td className="px-4 py-1.5 text-textMuted text-xs whitespace-nowrap overflow-hidden">
                {file.kind === 'directory' ? '--' : formatBytes(file.size)}
              </td>
              <td className="px-4 py-1.5 text-textMuted text-xs whitespace-nowrap hidden lg:table-cell overflow-hidden">
                {file.kind}
              </td>
            </>
          )}
        />
      </div>
    </div>
  );
};
