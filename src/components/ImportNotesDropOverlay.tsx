import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { isTauri } from '@/platform/detect';
import { useI18n } from '@/i18n/useI18n';
import {
  collectSourcesFromDataTransfer,
  collectSourcesFromDroppedPaths,
  type ImportNoteSource,
} from '@/utils/importNotes';
import { runImportNotesToCurrentSpace } from '@/utils/runImportNotes';

function hasFilePayload(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

interface ImportNotesDropOverlayProps {
  enabled: boolean;
}

const ImportNotesDropOverlay: React.FC<ImportNotesDropOverlayProps> = ({ enabled }) => {
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const importingRef = useRef(false);

  const importSources = useCallback(async (collect: () => Promise<ImportNoteSource[]>) => {
    if (!enabled || importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    try {
      const sources = await collect();
      await runImportNotesToCurrentSpace(sources);
    } finally {
      importingRef.current = false;
      setImporting(false);
      setDragging(false);
    }
  }, [enabled]);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (!hasFilePayload(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      if (enabled && !importingRef.current) setDragging(true);
    };

    const onDragLeave = (event: DragEvent) => {
      if (!hasFilePayload(event)) return;
      const leftWindow = event.clientX <= 0
        || event.clientY <= 0
        || event.clientX >= window.innerWidth
        || event.clientY >= window.innerHeight;
      if (leftWindow) setDragging(false);
    };

    const onDrop = (event: DragEvent) => {
      if (!hasFilePayload(event)) return;
      event.preventDefault();
      setDragging(false);
      if (isTauri()) return;
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) return;
      void importSources(() => collectSourcesFromDataTransfer(dataTransfer));
    };

    window.addEventListener('dragenter', onDragOver);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragOver);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [enabled, importSources]);

  useEffect(() => {
    if (!isTauri() || !enabled) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) => {
      if (cancelled) return;
      return getCurrentWebviewWindow().onDragDropEvent((event) => {
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          if (!importingRef.current) setDragging(true);
          return;
        }
        if (event.payload.type === 'leave') {
          setDragging(false);
          return;
        }
        if (event.payload.type === 'drop') {
          const paths = event.payload.paths;
          setDragging(false);
          void importSources(() => collectSourcesFromDroppedPaths(paths));
        }
      });
    }).then((fn) => {
      if (!fn) return;
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    }).catch((error) => {
      console.error('[tinynote] Failed to listen for file drop:', error);
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [enabled, importSources]);

  if (!dragging && !importing) return null;

  return (
    <div className="import-notes-drop-overlay" aria-live="polite">
      <div className="import-notes-drop-card">
        {importing
          ? <Loader2 size={28} className="settings-spin" />
          : <FileDown size={28} />}
        <strong>{importing ? t('importNotes.dropImporting') : t('importNotes.dropHint')}</strong>
        {!importing && <span>{t('importNotes.ruleMarkdownOnly')}</span>}
      </div>
    </div>
  );
};

export default ImportNotesDropOverlay;
