import React from 'react';
import { Upload, Download, RefreshCw } from 'lucide-react';
import { useI18n } from '../../I18nContext';
import { TransferItem, TransferStats } from './types';

interface TransferQueueProps {
  transfers: TransferItem[];
  stats: TransferStats;
}

export const TransferQueue: React.FC<TransferQueueProps> = ({ transfers, stats }) => {
  const { t } = useI18n();

  return (
    <div className="bg-sidebar border-t border-border flex flex-col">
      {transfers.length > 0 && (
        <div className="p-2 space-y-2 max-h-32 overflow-y-auto border-b border-border/50 bg-main/30">
          {transfers.map((tr, i) => (
            <div key={i} className="flex flex-col gap-1 px-2">
              <div className="flex justify-between text-[10px] text-textMuted">
                <span className="truncate max-w-[300px] flex items-center gap-1.5">
                  {tr.type === 'upload' ? <Upload size={10} className="text-accent" /> : <Download size={10} className="text-success" />}
                  {tr.name}
                </span>
                <span>{Math.round(tr.progress)}%</span>
              </div>
              <div className="h-1.5 w-full bg-main rounded-full overflow-hidden border border-border/30">
                <div className={`h-full transition-all duration-300 ${tr.type === 'upload' ? 'bg-accent' : 'bg-success'}`} style={{ width: `${tr.progress}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="h-8 flex items-center px-4 text-[10px] text-textMuted justify-between cursor-default transition-colors uppercase tracking-widest font-bold">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5">
            <RefreshCw size={12} className={transfers.length > 0 ? "text-accent animate-spin" : "text-textMuted"} />
            {transfers.length} {t('queue')}
          </span>
          <div className="w-px h-3 bg-border"></div>
          <span className="flex items-center gap-1.5 text-accent/80">
            <Upload size={12} /> {stats.uploads} {t('uploaded')}
          </span>
          <span className="flex items-center gap-1.5 text-success/80">
            <Download size={12} /> {stats.downloads} {t('downloaded')}
          </span>
        </div>
        <div className="text-[9px] opacity-60 uppercase tracking-widest font-bold">{t('sftpSessionActive')}</div>
      </div>
    </div>
  );
};
