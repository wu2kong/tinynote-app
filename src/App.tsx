import React, { Component, useEffect, useState, useCallback, type ErrorInfo, type ReactNode } from 'react';
import { useStore } from '@/store/useStore';
import AppBar from '@/components/AppBar';
import DirectoryPanel from '@/components/DirectoryPanel';
import NotePanel from '@/components/NotePanel';
import PropertyPanel from '@/components/PropertyPanel';
import MarkdownNotebookPanel from '@/components/MarkdownNotebookPanel';
import WriterNotebookPanel from '@/components/WriterNotebookPanel';
import WelcomeScreen from '@/components/WelcomeScreen';
import SettingsModal from '@/components/SettingsModal';
import GlobalSearchModal from '@/components/GlobalSearchModal';
import RecentNotebooksModal from '@/components/RecentNotebooksModal';
import AIChatModal from '@/components/AIChatModal';
import Toast from '@/components/Toast';
import ProUpgradeModal from '@/components/ProUpgradeModal';
import OfficialSampleLibraryModal from '@/components/OfficialSampleLibraryModal';
import ImportNotesModal from '@/components/ImportNotesModal';
import ImportNotesDropOverlay from '@/components/ImportNotesDropOverlay';
import { selectStoragePath } from '@/utils/fileSystem';
import { isTauri } from '@/platform/detect';
import { WORKSPACE_SWITCH_EVENT, OPEN_SETTINGS_EVENT, OPEN_IMPORT_NOTES_EVENT } from '@/utils/workspaceActions';
import { Code, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { serializeNoteBlocks } from '@/utils/noteParser';
import { FOCUS_DIRECTORY_SEARCH_EVENT } from '@/utils/searchActions';
import { useI18n } from '@/i18n/useI18n';
import { useLicenseStore } from '@/store/useLicenseStore';

class EditorAreaErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Editor area crashed:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: { children: ReactNode }) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const SourceEditorPanel: React.FC = () => {
  const { t } = useI18n();
  const currentNotebook = useStore((s) => s.currentNotebook);
  const toggleSourceMode = useStore((s) => s.toggleSourceMode);
  const applySourceContent = useStore((s) => s.applySourceContent);
  const showDirectoryPanel = useStore((s) => s.showDirectoryPanel);
  const showAppBar = useStore((s) => s.showAppBar);
  const toggleDirectoryPanel = useStore((s) => s.toggleDirectoryPanel);
  const [sourceContent, setSourceContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentNotebook?.isSourceMode) return;
    setSourceContent(serializeNoteBlocks(currentNotebook.noteBlocks));
  }, [currentNotebook?.path, currentNotebook?.isSourceMode]);

  if (!currentNotebook || !currentNotebook.isSourceMode) return null;

  const leftPanelVisible = showDirectoryPanel || showAppBar;

  return (
    <div className="source-editor-panel">
      <div className="source-editor-panel-header">
        <div className="source-editor-panel-header-left">
          <button
            className="left-panel-toggle"
            onClick={toggleDirectoryPanel}
            title={leftPanelVisible ? t('app.hideSidebar') : t('app.showSidebar')}
          >
            {leftPanelVisible ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <h3>{t('app.sourceMode', { name: currentNotebook.name })}</h3>
        </div>
        <button className="icon-btn" onClick={() => { toggleSourceMode(); setSourceContent(''); }} title={t('app.exitSourceMode')}>
          <Code size={16} />
        </button>
      </div>
      <textarea
        className="source-editor-panel-textarea"
        value={sourceContent}
        onChange={(e) => setSourceContent(e.target.value)}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <div className="source-editor-panel-footer">
        <button
          className="btn"
          onClick={() => { toggleSourceMode(); setSourceContent(''); }}
          title={t('app.exitSourceMode')}
        >
          {t('common.cancel')}
        </button>
        <button
          className="btn btn-primary"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            void applySourceContent(sourceContent)
              .then(() => setSourceContent(''))
              .finally(() => setSaving(false));
          }}
        >
          {t('app.saveAndParse')}
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { t } = useI18n();
  const storagePath = useStore((s) => s.storagePath);
  const initApp = useStore((s) => s.initApp);
  const setStoragePath = useStore((s) => s.setStoragePath);
  const currentNotebook = useStore((s) => s.currentNotebook);
  const showAppBar = useStore((s) => s.showAppBar);
  const showDirectoryPanel = useStore((s) => s.showDirectoryPanel);
  const zoomLevel = useStore((s) => s.zoomLevel);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showRecentNotebooks, setShowRecentNotebooks] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showSampleLibrary, setShowSampleLibrary] = useState(false);
  const [showImportNotes, setShowImportNotes] = useState(false);

  const switchWorkspace = useCallback(async (path: string) => {
    setLoading(true);
    try {
      await setStoragePath(path);
      await initApp();
      if (isTauri()) {
        const { refreshDesktopMenu } = await import('@/platform/desktopMenu');
        await refreshDesktopMenu();
      }
    } finally {
      setLoading(false);
    }
  }, [initApp, setStoragePath]);

  useEffect(() => {
    initApp()
      .finally(async () => {
        setLoading(false);
        if (isTauri()) {
          const { refreshDesktopMenu } = await import('@/platform/desktopMenu');
          await refreshDesktopMenu();
        }
      });
    void useLicenseStore.getState().hydrate();
  }, []);

  useEffect(() => {
    const onOpenSettings = () => setShowSettings(true);
    const onOpenImportNotes = () => setShowImportNotes(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
    window.addEventListener(OPEN_IMPORT_NOTES_EVENT, onOpenImportNotes);
    return () => {
      window.removeEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
      window.removeEventListener(OPEN_IMPORT_NOTES_EVENT, onOpenImportNotes);
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    const unlistenFns: (() => void)[] = [];
    const setup = async () => {
      const unlisten = await listen<{ path: string }>(WORKSPACE_SWITCH_EVENT, (event) => {
        void switchWorkspace(event.payload.path);
      });
      unlistenFns.push(unlisten);
    };
    setup();
    return () => { unlistenFns.forEach(fn => fn()); };
  }, [switchWorkspace]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault();
        setShowRecentNotebooks(true);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (e.shiftKey) {
          setShowGlobalSearch(true);
          return;
        }
        if (!useStore.getState().showDirectoryPanel) {
          useStore.getState().toggleDirectoryPanel();
        }
        requestAnimationFrame(() => window.dispatchEvent(new Event(FOCUS_DIRECTORY_SEARCH_EVENT)));
      } else if (e.key === '=') {
        e.preventDefault();
        useStore.getState().zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        useStore.getState().zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        useStore.getState().resetZoom();
      } else if (e.key.toLowerCase() === 'i' && !e.shiftKey) {
        e.preventDefault();
        setShowAIChat((value) => !value);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectStorage = async () => {
    const path = await selectStoragePath();
    if (path) {
      await switchWorkspace(path);
      setShowSampleLibrary(true);
    }
  };

  const settingsModal = (
    <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
  );
  const aiChatModal = <AIChatModal open={showAIChat} onClose={() => setShowAIChat(false)} />;
  const sharedOverlays = (
    <>
      <Toast />
      {settingsModal}
      {aiChatModal}
      <ProUpgradeModal />
      <OfficialSampleLibraryModal
        open={showSampleLibrary}
        onClose={() => setShowSampleLibrary(false)}
      />
      <ImportNotesModal
        open={showImportNotes}
        onClose={() => setShowImportNotes(false)}
      />
      <ImportNotesDropOverlay enabled={Boolean(storagePath) && !loading} />
    </>
  );

  if (loading) {
    return (
      <>
        <div className="app-layout" style={{ width: `calc(100vw / ${zoomLevel})`, height: `calc(100vh / ${zoomLevel})` }}>
          <div className="loading-screen">
            <div className="loading-icon">📝</div>
            <div className="loading-text">{t('app.loading')}</div>
          </div>
        </div>
        {sharedOverlays}
      </>
    );
  }

  if (!storagePath) {
    return (
      <>
        <WelcomeScreen onSelectStorage={handleSelectStorage} />
        {sharedOverlays}
      </>
    );
  }

  const isSourceMode = currentNotebook?.isSourceMode;
  const isMarkdownNotebook = currentNotebook?.format === 'markdown';
  const isWriterNotebook = currentNotebook?.format === 'writer';

  return (
    <div className="app-layout" style={{ width: `calc(100vw / ${zoomLevel})`, height: `calc(100vh / ${zoomLevel})` }}>
      {showAppBar && <AppBar onOpenGlobalSearch={() => setShowGlobalSearch(true)} />}
      {showDirectoryPanel && <DirectoryPanel />}
      <EditorAreaErrorBoundary
        fallback={
          <div className="note-panel">
            <div className="note-panel-empty">{t('note.selectNotebook')}</div>
          </div>
        }
      >
        {isWriterNotebook ? (
          <WriterNotebookPanel />
        ) : isMarkdownNotebook ? (
          <MarkdownNotebookPanel />
        ) : isSourceMode ? (
          <SourceEditorPanel />
        ) : (
          <>
            <NotePanel />
            <PropertyPanel />
          </>
        )}
      </EditorAreaErrorBoundary>
      <GlobalSearchModal open={showGlobalSearch} onClose={() => setShowGlobalSearch(false)} />
      <RecentNotebooksModal open={showRecentNotebooks} onClose={() => setShowRecentNotebooks(false)} />
      {sharedOverlays}
    </div>
  );
};

export default App;
