import '@/polyfills/nodeBuffer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializePlatform } from '@/platform/init';
import { isTauri } from '@/platform/detect';
import { IS_MAC_APP_STORE } from '@/constants/distribution';
import './styles/themes/index.css';
import './styles/global.css';

if (!IS_MAC_APP_STORE) {
  void import('./styles/ai-chat.css');
}

async function bootstrap() {
  if (!isTauri()) {
    try {
      await initializePlatform();
    } catch (error) {
      console.warn('[tinynote] Platform bootstrap failed:', error);
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  if (!isTauri()) return;
  try {
    const { configureNativeUpdaterFeed } = await import('@/utils/updater');
    await configureNativeUpdaterFeed();
  } catch (error) {
    console.warn('[tinynote] Updater feed setup failed:', error);
  }
  try {
    const { initDesktopMenu } = await import('@/platform/desktopMenu');
    await initDesktopMenu();
  } catch (error) {
    console.warn('[tinynote] Desktop menu setup failed:', error);
  }
}

void bootstrap();
