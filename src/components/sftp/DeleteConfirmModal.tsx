import React, { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { useI18n } from '../../I18nContext';
import { SftpEntry } from '../../types';

interface DeleteConfirmModalProps {
  file: SftpEntry;
  paneId: 'local' | 'remote';
  onConfirm: (file: SftpEntry, paneId: 'local' | 'remote') => Promise<void>;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ file, paneId, onConfirm, onCancel }) => {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(file, paneId);
    } catch (err) {
      setIsDeleting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-main/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={`bg-sidebar border border-border rounded-xl shadow-2xl w-80 p-6 flex flex-col gap-4 transition-all duration-300 ${isDeleting ? 'opacity-80 scale-95 pointer-events-none' : 'scale-in-center'}`}>
        <div className="flex flex-col gap-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${isDeleting ? 'bg-textMuted/10 text-textMuted animate-pulse' : 'bg-error/10 text-error'}`}>
            {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
          </div>
          <h3 className="text-sm font-bold text-textMain">{isDeleting ? t('deleting') : t('confirmDelete')}</h3>
          <p className="text-xs text-textMuted leading-relaxed">
            <span className="text-textMain font-mono bg-hover px-1 rounded block truncate mb-1">{file.name}</span>
            {isDeleting ? t('pleaseWait') : t('deletedWarning')}
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 text-xs font-medium bg-main hover:bg-hover border border-border rounded-lg transition-colors disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className={`flex-1 px-4 py-2 text-xs font-bold rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 ${isDeleting ? 'bg-error/50 text-white shadow-none' : 'bg-error text-white hover:bg-error/90 shadow-error/20'}`}
          >
            {isDeleting && <Loader2 size={12} className="animate-spin" />}
            {isDeleting ? t('deleting') : t('deleteAnyway')}
          </button>
        </div>
      </div>
    </div>
  );
};
