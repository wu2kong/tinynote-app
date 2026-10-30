import React, { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n/useI18n';
import { getMarkdownNotebookExtensions } from '@/utils/codemirrorExtensions';
import { registerDocumentSaveFlusher } from '@/utils/documentSaveFlush';
import MarkdownPreview from './MarkdownPreview';

const SAVE_DEBOUNCE_MS = 400;

type MarkdownViewMode = 'edit' | 'preview' | 'split';

const VIEW_MODE_OPTIONS: { value: MarkdownViewMode; labelKey: string }[] = [
  { value: 'edit', labelKey: 'editor.viewModes.edit' },
  { value: 'preview', labelKey: 'editor.viewModes.preview' },
  { value: 'split', labelKey: 'editor.viewModes.split' },
];

const MarkdownNotebookPanel: React.FC = () => {
  const { t } = useI18n();
  const currentNotebook = useStore((s) => s.currentNotebook);
  const isDarkTheme = useStore((s) => s.isDarkTheme);
  const showDirectoryPanel = useStore((s) => s.showDirectoryPanel);
  const showAppBar = useStore((s) => s.showAppBar);
  const toggleDirectoryPanel = useStore((s) => s.toggleDirectoryPanel);
  const updateNotebookContent = useStore((s) => s.updateNotebookContent);

  const [localContent, setLocalContent] = useState('');
  const [viewMode, setViewMode] = useState<MarkdownViewMode>('edit');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notebookPathRef = useRef<string | null>(null);
  const localContentRef = useRef(localContent);
  localContentRef.current = localContent;
  const updateNotebookContentRef = useRef(updateNotebookContent);
  updateNotebookContentRef.current = updateNotebookContent;

  const flushPendingSave = (): Promise<void> => {
    if (!saveTimerRef.current) return Promise.resolve();
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const path = notebookPathRef.current;
    if (!path) return Promise.resolve();
    return updateNotebookContentRef.current(localContentRef.current, path);
  };

  const flushPendingSaveRef = useRef(flushPendingSave);
  flushPendingSaveRef.current = flushPendingSave;

  useEffect(() => {
    if (!currentNotebook || (currentNotebook.format !== 'markdown' && !currentNotebook.compatOpenAsMarkdown)) return;
    if (notebookPathRef.current !== currentNotebook.path) {
      notebookPathRef.current = currentNotebook.path;
      setLocalContent(currentNotebook.content ?? '');
      setViewMode('edit');
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      return;
    }
    if ((currentNotebook.content ?? '') !== localContent && !saveTimerRef.current) {
      setLocalContent(currentNotebook.content ?? '');
    }
  }, [currentNotebook?.path, currentNotebook?.content, currentNotebook?.format, localContent]);

  useEffect(() => registerDocumentSaveFlusher(() => flushPendingSaveRef.current()), []);

  useEffect(() => () => {
    void flushPendingSaveRef.current();
  }, [currentNotebook?.path]);

  const extensions = useMemo(() => getMarkdownNotebookExtensions(), []);

  if (!currentNotebook || (currentNotebook.format !== 'markdown' && !currentNotebook.compatOpenAsMarkdown)) {
    return (
      <div className="markdown-notebook-panel">
        <div className="markdown-notebook-empty">{t('note.selectNotebook')}</div>
      </div>
    );
  }

  const leftPanelVisible = showDirectoryPanel || showAppBar;
  const showEditor = viewMode === 'edit' || viewMode === 'split';
  const showPreview = viewMode === 'preview' || viewMode === 'split';

  const handleChange = (value: string) => {
    setLocalContent(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void updateNotebookContent(value, currentNotebook.path);
    }, SAVE_DEBOUNCE_MS);
  };

  return (
    <div className="markdown-notebook-panel">
      <div className="markdown-notebook-header">
        <div className="markdown-notebook-header-left">
          <button
            className="left-panel-toggle"
            onClick={toggleDirectoryPanel}
            title={leftPanelVisible ? t('app.hideSidebar') : t('app.showSidebar')}
          >
            {leftPanelVisible ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div className="markdown-notebook-title-wrap">
            <h3>{currentNotebook.name}</h3>
            <span className="markdown-notebook-format-badge">
              {currentNotebook.compatOpenAsMarkdown
                ? t('note.unsupportedFormat.compatBadge')
                : t('directory.formats.markdown')}
            </span>
          </div>
        </div>
        <div
          className="markdown-notebook-mode-toggle"
          role="group"
          aria-label={t('editor.viewMode')}
        >
          {VIEW_MODE_OPTIONS.map(({ value, labelKey }) => (
            <button
              key={value}
              type="button"
              className={viewMode === value ? 'active' : undefined}
              onClick={() => setViewMode(value)}
              aria-pressed={viewMode === value}
              title={t(labelKey)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className={`markdown-notebook-body mode-${viewMode}`}>
        {showEditor && (
          <div className="markdown-notebook-editor">
            <CodeMirror
              value={localContent}
              height="100%"
              theme={isDarkTheme ? oneDark : undefined}
              extensions={extensions}
              onChange={handleChange}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                bracketMatching: true,
                autocompletion: true,
              }}
            />
          </div>
        )}
        {showPreview && (
          <aside className="markdown-notebook-preview" aria-label={t('editor.markdownPreview')}>
            {viewMode === 'split' && (
              <div className="professional-editor-preview-title">{t('editor.preview')}</div>
            )}
            <MarkdownPreview content={localContent} />
          </aside>
        )}
      </div>
    </div>
  );
};

export default MarkdownNotebookPanel;
