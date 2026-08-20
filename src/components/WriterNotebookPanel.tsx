import React, { useEffect, useRef, useState } from 'react';
import { Crepe } from '@milkdown/crepe';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n/useI18n';
import { writerListContinuationPlugin } from '@/utils/writerListContinuationPlugin';
import { writerEmptyClickPlugin } from '@/utils/writerEmptyClickPlugin';
import { registerDocumentSaveFlusher } from '@/utils/documentSaveFlush';
import '@milkdown/crepe/theme/common/style.css';

/** Light code theme: Crepe defaults to oneDark, which leaves a black active-line gutter. */
const lightCodeTheme = EditorView.theme({
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
}, { dark: false });

const SAVE_DEBOUNCE_MS = 400;
const PAGE_WIDTH_STORAGE_KEY = 'tinynote.writerPageWidth';

type WriterPageWidth = 'narrow' | 'standard' | 'full';

const PAGE_WIDTH_OPTIONS: { value: WriterPageWidth; labelKey: string }[] = [
  { value: 'narrow', labelKey: 'editor.pageWidths.narrow' },
  { value: 'standard', labelKey: 'editor.pageWidths.standard' },
  { value: 'full', labelKey: 'editor.pageWidths.full' },
];

function readStoredPageWidth(): WriterPageWidth {
  try {
    const stored = localStorage.getItem(PAGE_WIDTH_STORAGE_KEY);
    if (stored === 'narrow' || stored === 'standard' || stored === 'full') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'standard';
}

interface WriterEditorProps {
  notebookPath: string;
  defaultValue: string;
  isDarkTheme: boolean;
  onMarkdownChange: (markdown: string, notebookPath: string) => void;
}

const WriterEditor: React.FC<WriterEditorProps> = ({
  notebookPath,
  defaultValue,
  isDarkTheme,
  onMarkdownChange,
}) => {
  const onChangeRef = useRef(onMarkdownChange);
  onChangeRef.current = onMarkdownChange;

  useEditor((root) => {
    const editorPath = notebookPath;
    const crepe = new Crepe({
      root,
      defaultValue,
      features: {
        [Crepe.Feature.Latex]: false,
        [Crepe.Feature.AI]: false,
      },
      featureConfigs: {
        // Native caret: Crepe's virtual cursor misplaces under documentElement CSS zoom.
        [Crepe.Feature.Cursor]: {
          virtual: false,
        },
        [Crepe.Feature.CodeMirror]: {
          theme: isDarkTheme ? oneDark : lightCodeTheme,
        },
      },
    });

    crepe.editor.use(writerListContinuationPlugin);
    crepe.editor.use(writerEmptyClickPlugin);

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
        if (markdown === prevMarkdown) return;
        onChangeRef.current(markdown, editorPath);
      });
    });

    return crepe;
  }, [notebookPath, isDarkTheme]);

  return <Milkdown />;
};

const WriterNotebookPanel: React.FC = () => {
  const { t } = useI18n();
  const currentNotebook = useStore((s) => s.currentNotebook);
  const isDarkTheme = useStore((s) => s.isDarkTheme);
  const showDirectoryPanel = useStore((s) => s.showDirectoryPanel);
  const showAppBar = useStore((s) => s.showAppBar);
  const toggleDirectoryPanel = useStore((s) => s.toggleDirectoryPanel);
  const updateNotebookContent = useStore((s) => s.updateNotebookContent);

  const [pageWidth, setPageWidth] = useState<WriterPageWidth>(readStoredPageWidth);
  const [widthSelectWidth, setWidthSelectWidth] = useState<number | undefined>(undefined);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ path: string; markdown: string } | null>(null);
  const widthSelectRef = useRef<HTMLSelectElement>(null);
  const widthMeasureRef = useRef<HTMLSpanElement>(null);

  const updateNotebookContentRef = useRef(updateNotebookContent);
  updateNotebookContentRef.current = updateNotebookContent;

  const flushPendingSave = (): Promise<void> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (!pending) return Promise.resolve();
    return updateNotebookContentRef.current(pending.markdown, pending.path);
  };

  const flushPendingSaveRef = useRef(flushPendingSave);
  flushPendingSaveRef.current = flushPendingSave;

  useEffect(() => registerDocumentSaveFlusher(() => flushPendingSaveRef.current()), []);

  useEffect(() => () => {
    void flushPendingSaveRef.current();
  }, [currentNotebook?.path]);

  useEffect(() => {
    const measure = widthMeasureRef.current;
    const select = widthSelectRef.current;
    if (!measure || !select) return;
    const label = t(
      PAGE_WIDTH_OPTIONS.find((option) => option.value === pageWidth)?.labelKey
        ?? 'editor.pageWidths.standard',
    );
    measure.textContent = label;
    const styles = window.getComputedStyle(select);
    measure.style.font = styles.font;
    measure.style.letterSpacing = styles.letterSpacing;
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
    const borderLeft = Number.parseFloat(styles.borderLeftWidth) || 0;
    const borderRight = Number.parseFloat(styles.borderRightWidth) || 0;
    setWidthSelectWidth(Math.ceil(measure.offsetWidth + paddingLeft + paddingRight + borderLeft + borderRight + 2));
  }, [pageWidth, t]);

  const handlePageWidthChange = (next: WriterPageWidth) => {
    setPageWidth(next);
    try {
      localStorage.setItem(PAGE_WIDTH_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  if (!currentNotebook || currentNotebook.format !== 'writer') {
    return (
      <div className="writer-notebook-panel">
        <div className="writer-notebook-empty">{t('note.selectNotebook')}</div>
      </div>
    );
  }

  const leftPanelVisible = showDirectoryPanel || showAppBar;

  const handleMarkdownChange = (markdown: string, notebookPath: string) => {
    if (pendingSaveRef.current && pendingSaveRef.current.path !== notebookPath) {
      flushPendingSave();
    }
    pendingSaveRef.current = { path: notebookPath, markdown };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (pending) {
        void updateNotebookContent(pending.markdown, pending.path);
      }
    }, SAVE_DEBOUNCE_MS);
  };

  return (
    <div className={`writer-notebook-panel${isDarkTheme ? ' dark' : ''}`}>
      <div className="writer-notebook-header">
        <div className="writer-notebook-header-left">
          <button
            className="left-panel-toggle"
            onClick={toggleDirectoryPanel}
            title={leftPanelVisible ? t('app.hideSidebar') : t('app.showSidebar')}
          >
            {leftPanelVisible ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div className="writer-notebook-title-wrap">
            <h3>{currentNotebook.name}</h3>
            <span className="writer-notebook-format-badge">{t('directory.formats.writer')}</span>
          </div>
        </div>
        <label className="markdown-notebook-mode-select-wrap">
          <span className="sr-only">{t('editor.pageWidth')}</span>
          <span ref={widthMeasureRef} className="markdown-notebook-mode-measure" aria-hidden="true" />
          <select
            ref={widthSelectRef}
            className="markdown-notebook-mode-select"
            value={pageWidth}
            onChange={(e) => handlePageWidthChange(e.target.value as WriterPageWidth)}
            aria-label={t('editor.pageWidth')}
            title={t('editor.pageWidth')}
            style={widthSelectWidth ? { width: widthSelectWidth } : undefined}
          >
            {PAGE_WIDTH_OPTIONS.map(({ value, labelKey }) => (
              <option key={value} value={value}>{t(labelKey)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={`writer-notebook-body page-width-${pageWidth}`}>
        <MilkdownProvider key={`${currentNotebook.path}:${isDarkTheme ? 'dark' : 'light'}`}>
          <WriterEditor
            notebookPath={currentNotebook.path}
            defaultValue={currentNotebook.content ?? ''}
            isDarkTheme={isDarkTheme}
            onMarkdownChange={handleMarkdownChange}
          />
        </MilkdownProvider>
      </div>
    </div>
  );
};

export default WriterNotebookPanel;
