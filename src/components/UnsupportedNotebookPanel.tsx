import React from 'react';
import { CircleAlert } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n/useI18n';
import { DOWNLOAD_PAGE_URL } from '@/constants/app';
import { getUnknownNotebookFormatSuffix } from '@/utils/notebookFormat';
import { basename } from '@/utils/path';

const UnsupportedNotebookPanel: React.FC = () => {
  const { t } = useI18n();
  const currentNotebook = useStore((s) => s.currentNotebook);
  const openUnsupportedAsMarkdown = useStore((s) => s.openUnsupportedAsMarkdown);

  if (!currentNotebook || currentNotebook.format !== 'unsupported') {
    return (
      <div className="note-panel">
        <div className="note-panel-empty">{t('note.selectNotebook')}</div>
      </div>
    );
  }

  const suffix = getUnknownNotebookFormatSuffix(basename(currentNotebook.path)) ?? '';

  const handleUpgrade = async () => {
    try {
      await openUrl(DOWNLOAD_PAGE_URL);
    } catch (error) {
      console.error('Failed to open download page:', error);
    }
  };

  return (
    <div className="unsupported-notebook-panel">
      <CircleAlert size={40} className="unsupported-notebook-icon" />
      <h3>{t('note.unsupportedFormat.title')}</h3>
      <p>{t('note.unsupportedFormat.message', { suffix })}</p>
      <div className="unsupported-notebook-actions">
        <button type="button" className="btn btn-primary" onClick={() => void handleUpgrade()}>
          {t('note.unsupportedFormat.upgrade')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={openUnsupportedAsMarkdown}>
          {t('note.unsupportedFormat.openAsMarkdown')}
        </button>
      </div>
    </div>
  );
};

export default UnsupportedNotebookPanel;
