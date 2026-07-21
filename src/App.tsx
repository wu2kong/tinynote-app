import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import AppBar from '@/components/AppBar';
import DirectoryPanel from '@/components/DirectoryPanel';
import NotePanel from '@/components/NotePanel';
import PropertyPanel from '@/components/PropertyPanel';
import WelcomeScreen from '@/components/WelcomeScreen';
import SettingsModal from '@/components/SettingsModal';
import GlobalSearchModal from '@/components/GlobalSearchModal';
import RecentNotebooksModal from '@/components/RecentNotebooksModal';
import AIChatModal from '@/components/AIChatModal';
import Toast from '@/components/Toast';
import { selectStoragePath } from '@/utils/fileSystem';
import { isTauri } from '@/platform/detect';
import { WORKSPACE_SWITCH_EVENT, OPEN_SETTINGS_EVENT } from '@/utils/workspaceActions';
import { Code, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { serializeNoteBlocks, parseNoteBlocks } from '@/utils/noteParser';
import { FOCUS_DIRECTORY_SEARCH_EVENT } from '@/utils/searchActions';

const SourceEditorPanel: React.FC = () => {
  const currentNotebook = useStore((s) => s.currentNotebook);
  const toggleSourceMode = useStore((s) => s.toggleSourceMode);
  const showDirectoryPanel = useStore((s) => s.showDirectoryPanel);
  const showAppBar = useStore((s) => s.showAppBar);
  const toggleDirectoryPanel = useStore((s) => s.toggleDirectoryPanel);
  const [sourceContent, setSourceContent] = useState('');

  if (!currentNotebook || !currentNotebook.isSourceMode) return null;

  const source = serializeNoteBlocks(currentNotebook.noteBlocks);
  if (!sourceContent && source) {
    setSourceContent(source);
  }

  const leftPanelVisible = showDirectoryPanel || showAppBar;

  return (
    <div className="source-editor-panel">
      <div className="source-editor-panel-header">
        <div className="source-editor-panel-header-left">
          <button
            className="left-panel-toggle"
            onClick={toggleDirectoryPanel}
            title={leftPanelVisible ? '隐藏侧边栏' : '显示侧边栏'}
          >
            {leftPanelVisible ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <h3>{currentNotebook.name} — 源码模式</h3>
        </div>
        <button className="icon-btn" onClick={() => { toggleSourceMode(); setSourceContent(''); }} title="退出源码模式">
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
          title="退出源码模式"
        >
          取消
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            const blocks = parseNoteBlocks(sourceContent);
            useStore.setState((state) => ({
              currentNotebook: { ...state.currentNotebook!, noteBlocks: blocks, isSourceMode: false },
            }));
            setSourceContent('');
          }}
        >
          保存并解析
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
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
  }, []);

  useEffect(() => {
    const onOpenSettings = () => setShowSettings(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    const unlistenFns: (() => void)[] = [];
    const setup = async () => {
      const un1 = await listen<string>('toggle_app_bar', () => {
        useStore.getState().toggleAppBar();
      });
      unlistenFns.push(un1);
      const un2 = await listen<string>('toggle_directory', () => {
        useStore.getState().toggleDirectoryPanel();
      });
      unlistenFns.push(un2);
      const un3 = await listen<{ path: string }>(WORKSPACE_SWITCH_EVENT, (event) => {
        void switchWorkspace(event.payload.path);
      });
      unlistenFns.push(un3);
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
    }
  };

  const settingsModal = (
    <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
  );
  const aiChatModal = <AIChatModal open={showAIChat} onClose={() => setShowAIChat(false)} />;

  if (loading) {
    return (
      <>
        <div className="app-layout" style={{ width: `calc(100vw / ${zoomLevel})`, height: `calc(100vh / ${zoomLevel})` }}>
          <div className="loading-screen">
            <div className="loading-icon">📝</div>
            <div className="loading-text">正在加载...</div>
          </div>
        </div>
        {settingsModal}
        {aiChatModal}
      </>
    );
  }

  if (!storagePath) {
    return (
      <>
        <WelcomeScreen onSelectStorage={handleSelectStorage} />
        {settingsModal}
        {aiChatModal}
      </>
    );
  }

  const isSourceMode = currentNotebook?.isSourceMode;

  return (
    <div className="app-layout" style={{ width: `calc(100vw / ${zoomLevel})`, height: `calc(100vh / ${zoomLevel})` }}>
      {showAppBar && <AppBar onOpenGlobalSearch={() => setShowGlobalSearch(true)} />}
      {showDirectoryPanel && <DirectoryPanel />}
      {isSourceMode ? (
        <SourceEditorPanel />
      ) : (
        <>
          <NotePanel />
          <PropertyPanel />
        </>
      )}
      <Toast />
      {settingsModal}
      <GlobalSearchModal open={showGlobalSearch} onClose={() => setShowGlobalSearch(false)} />
      <RecentNotebooksModal open={showRecentNotebooks} onClose={() => setShowRecentNotebooks(false)} />
      {aiChatModal}
    </div>
  );
};

export default App;
