import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, Boxes, FileText, Loader2, PenLine, Sparkles, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useI18n, type AppLocale } from '@/i18n/useI18n';
import { importOfficialSampleLibrary } from '@/utils/officialSampleLibrary';
import * as fs from '@/utils/fileSystem';
import { normalizePath } from '@/utils/path';
import { showToast } from './Toast';

interface OfficialSampleLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

const OfficialSampleLibraryModal: React.FC<OfficialSampleLibraryModalProps> = ({
  open,
  onClose,
  onImported,
}) => {
  const { t, locales } = useI18n();
  const storagePath = useStore((state) => state.storagePath);
  const [importing, setImporting] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<AppLocale>('en');

  useEffect(() => {
    if (open) setTargetLanguage('en');
  }, [open]);

  const handleImport = useCallback(async () => {
    if (!storagePath || importing) return;
    setImporting(true);
    try {
      const result = await importOfficialSampleLibrary(storagePath, targetLanguage);
      await useStore.getState().reloadSpaces();
      const importedSpace = useStore.getState().spaces.find(
        (space) => normalizePath(space.path) === normalizePath(result.spacePath),
      );
      if (importedSpace) {
        await useStore.getState().selectSpace(importedSpace);
        const welcomeNotebook = await fs.loadNotebook(result.welcomeNotebookPath);
        if (welcomeNotebook) await useStore.getState().revealNotebook(welcomeNotebook);
      }
      showToast(t('sampleLibrary.imported', { name: result.spaceName, count: result.noteCount }));
      onImported?.();
      onClose();
    } catch (error) {
      console.error('Failed to import official sample library:', error);
      showToast(t('sampleLibrary.importFailed'));
    } finally {
      setImporting(false);
    }
  }, [importing, onClose, onImported, storagePath, t, targetLanguage]);

  if (!open) return null;

  return (
    <div className="modal-overlay sample-library-overlay" onClick={importing ? undefined : onClose}>
      <div
        className="sample-library-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sample-library-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="icon-btn sample-library-close"
          onClick={onClose}
          disabled={importing}
          title={t('common.close')}
        >
          <X size={18} />
        </button>

        <div className="sample-library-hero-icon"><Sparkles size={24} /></div>
        <h2 id="sample-library-title" className="sample-library-title">{t('sampleLibrary.title')}</h2>
        <p className="sample-library-description">{t('sampleLibrary.description')}</p>

        <div className="sample-library-formats">
          <div className="sample-library-format">
            <Boxes size={18} />
            <div><strong>{t('sampleLibrary.blocksTitle')}</strong><span>{t('sampleLibrary.blocksDesc')}</span></div>
          </div>
          <div className="sample-library-format">
            <FileText size={18} />
            <div><strong>{t('sampleLibrary.markdownTitle')}</strong><span>{t('sampleLibrary.markdownDesc')}</span></div>
          </div>
          <div className="sample-library-format">
            <PenLine size={18} />
            <div><strong>{t('sampleLibrary.writerTitle')}</strong><span>{t('sampleLibrary.writerDesc')}</span></div>
          </div>
        </div>

        <p className="sample-library-note">
          <BookOpen size={14} />
          {t('sampleLibrary.safeImportNote')}
        </p>

        <div className="sample-library-footer">
          <label className="sample-library-language">
            <span>{t('sampleLibrary.contentLanguage')}</span>
            <select
              className="settings-select sample-library-language-select"
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value as AppLocale)}
              disabled={importing}
            >
              {locales.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="sample-library-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={importing}>
              {t('sampleLibrary.notNow')}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleImport} disabled={importing || !storagePath}>
              {importing ? <Loader2 size={16} className="settings-spin" /> : <Sparkles size={16} />}
              {importing ? t('sampleLibrary.importing') : t('sampleLibrary.importAction')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficialSampleLibraryModal;
