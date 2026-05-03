import React from 'react';
import { HardDrive } from 'lucide-react';
import { useI18n } from '../../I18nContext';
import { SftpEntry } from '../../types';
import { FilePane } from './FilePane';

interface LocalPanelProps {
  path: string;
  files: SftpEntry[];
  selectedFile: SftpEntry | null;
  onSelect: (file: SftpEntry | null) => void;
  onFileDrop: (file: SftpEntry, sourcePaneId: string) => void;
  onNavigate: (newPath: string) => void;
  onRefresh: () => void;
  onGoHome: () => void;
  onDelete: (file: SftpEntry) => void;
}

export const LocalPanel: React.FC<LocalPanelProps> = ({
  path, files, selectedFile, onSelect, onFileDrop, onNavigate, onRefresh, onGoHome, onDelete
}) => {
  const { t } = useI18n();

  return (
    <FilePane
      paneId="local"
      title={t('localMachine')}
      icon={<HardDrive size={16} className="text-textMuted" />}
      path={path}
      files={files}
      selectedFile={selectedFile}
      onSelect={onSelect}
      onFileDrop={onFileDrop}
      onNavigate={onNavigate}
      onRefresh={onRefresh}
      onGoHome={onGoHome}
      onDelete={onDelete}
    />
  );
};
