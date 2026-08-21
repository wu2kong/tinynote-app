import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileInput, FolderInput, Loader2, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n/useI18n';
import { isTauri } from '@/platform/detect';
import {
  collectSourcesFromBrowserFiles,
  collectSourcesFromDirectoryPaths,
  collectSourcesFromFilePaths,
  pickDirectories,
  pickMarkdownFiles,
  type ImportNoteSource,
} from '@/utils/importNotes';
import { runImportNotesToCurrentSpace } from '@/utils/runImportNotes';
import { showToast } from './Toast';

interface ImportNotesModalProps {
  open: boolean;
  onClose: () => void;
}

const ImportNotesModal: React.FC<ImportNotesModalProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const currentSpace = useStore((s) => s.currentSpace);
  const [importing, setImporting] = useState(false);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const dirsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = dirsInputRef.current;
    if (!input) return;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
  }, [open]);

  const runImport = useCallback(async (sources: ImportNoteSource[]) => {
    if (!currentSpace) {
      showToast(t('importNotes.noSpace'));
      return;
    }
    if (sources.length === 0) {
      showToast(t('importNotes.noMarkdown'));
      return;
    }

    setImporting(true);
    try {
      const imported = await runImportNotesToCurrentSpace(sources);
      if (imported) onClose();
    } finally {
      setImporting(false);
    }
  }, [currentSpace, onClose, t]);

  const handleImportFiles = useCallback(async () => {
    if (importing) return;
    if (!currentSpace) {
      showToast(t('importNotes.noSpace'));
      return;
    }
    if (!isTauri()) {
      filesInputRef.current?.click();
      return;
    }
    const paths = await pickMarkdownFiles();
    if (paths.length === 0) return;
    await runImport(await collectSourcesFromFilePaths(paths));
  }, [currentSpace, importing, runImport, t]);

  const handleImportDirectories = useCallback(async () => {
    if (importing) return;
    if (!currentSpace) {
      showToast(t('importNotes.noSpace'));
      return;
    }
    if (!isTauri()) {
      dirsInputRef.current?.click();
      return;
    }
    const paths = await pickDirectories();
    if (paths.length === 0) return;
    await runImport(await collectSourcesFromDirectoryPaths(paths));
  }, [currentSpace, importing, runImport, t]);

  const handleBrowserFiles = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
    mode: 'files' | 'directories',
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    await runImport(collectSourcesFromBrowserFiles(files, mode));
  }, [runImport]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={importing ? undefined : onClose}>
      <div
        className="modal import-notes-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-notes-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="icon-btn import-notes-close"
          onClick={onClose}
          disabled={importing}
          title={t('common.close')}
        >
          <X size={16} />
        </button>

        <h3 id="import-notes-title" className="modal-title">{t('importNotes.title')}</h3>
        <p className="modal-hint">{t('importNotes.description')}</p>
        <ul className="import-notes-rules">
          <li>{t('importNotes.ruleMarkdownOnly')}</li>
          <li>{t('importNotes.ruleFormats')}</li>
          <li>{t('importNotes.ruleUnmarked')}</li>
          <li>{t('importNotes.ruleTarget')}</li>
          <li>{t('importNotes.ruleMultiple')}</li>
          <li>{t('importNotes.ruleDrop')}</li>
        </ul>

        <input
          ref={filesInputRef}
          type="file"
          accept=".md,.blk.md,.mk.md,.writer.md,text/markdown"
          multiple
          hidden
          onChange={(event) => { void handleBrowserFiles(event, 'files'); }}
        />
        <input
          ref={dirsInputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => { void handleBrowserFiles(event, 'directories'); }}
        />

        <div className="import-notes-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { void handleImportFiles(); }}
            disabled={importing}
          >
            {importing ? <Loader2 size={14} className="settings-spin" /> : <FileInput size={14} />}
            {t('importNotes.importFiles')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { void handleImportDirectories(); }}
            disabled={importing}
          >
            {importing ? <Loader2 size={14} className="settings-spin" /> : <FolderInput size={14} />}
            {t('importNotes.importDirectories')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportNotesModal;
