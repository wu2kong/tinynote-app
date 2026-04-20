import React, { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import AppBar from '@/components/AppBar';
import DirectoryPanel from '@/components/DirectoryPanel';
import NotePanel from '@/components/NotePanel';
import PropertyPanel from '@/components/PropertyPanel';
import WelcomeScreen from '@/components/WelcomeScreen';
import Toast from '@/components/Toast';
import { selectStoragePath } from '@/utils/fileSystem';
import { Code } from 'lucide-react';
import { serializeNoteBlocks, parseNoteBlocks } from '@/utils/noteParser';

const SourceEditorPanel: React.FC = () => {
  const currentNotebook = useStore((s) => s.currentNotebook);
  const toggleSourceMode = useStore((s) => s.toggleSourceMode);
  const [sourceContent, setSourceContent] = useState('');

  if (!currentNotebook || !currentNotebook.isSourceMode) return null;

  const source = serializeNoteBlocks(currentNotebook.noteBlocks);
  if (!sourceContent && source) {
    setSourceContent(source);
  }

  return (
    <div className="source-editor-panel">
      <div className="source-editor-panel-header">
        <h3>{currentNotebook.name} — 源码模式</h3>
        <button className="icon-btn" onClick={() => { toggleSourceMode(); setSourceContent(''); }} title="退出源码模式">
          <Code size={16} />
        </button>
      </div>
      <textarea
        className="source-editor-panel-textarea"
        value={sourceContent}
        onChange={(e) => setSourceContent(e.target.value)}
        spellCheck={false}
      />
      <div className="source-editor-panel-footer">
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initApp().finally(() => setLoading(false));
  }, []);

  const handleSelectStorage = async () => {
    const path = await selectStoragePath();
    if (path) {
      setLoading(true);
      await setStoragePath(path);
      await initApp();
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="app-layout">
        <div className="loading-screen">
          <div className="loading-icon">📝</div>
          <div className="loading-text">正在加载...</div>
        </div>
      </div>
    );
  }

  if (!storagePath) {
    return <WelcomeScreen onSelectStorage={handleSelectStorage} />;
  }

  const isSourceMode = currentNotebook?.isSourceMode;

  return (
    <div className="app-layout">
      <AppBar />
      <DirectoryPanel />
      {isSourceMode ? (
        <SourceEditorPanel />
      ) : (
        <>
          <NotePanel />
          <PropertyPanel />
        </>
      )}
      <Toast />
    </div>
  );
};

export default App;