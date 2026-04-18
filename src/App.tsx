import React, { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import AppBar from '@/components/AppBar';
import DirectoryPanel from '@/components/DirectoryPanel';
import NotePanel from '@/components/NotePanel';
import PropertyPanel from '@/components/PropertyPanel';
import WelcomeScreen from '@/components/WelcomeScreen';
import { selectStoragePath } from '@/utils/fileSystem';

const App: React.FC = () => {
  const storagePath = useStore((s) => s.storagePath);
  const initApp = useStore((s) => s.initApp);
  const setStoragePath = useStore((s) => s.setStoragePath);
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

  return (
    <div className="app-layout">
      <AppBar />
      <DirectoryPanel />
      <NotePanel />
      <PropertyPanel />
    </div>
  );
};

export default App;