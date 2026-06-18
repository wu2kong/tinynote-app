import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializePlatform } from '@/platform/init';
import { isTauri } from '@/platform/detect';
import './styles/themes/index.css';
import './styles/global.css';

async function bootstrap() {
  await initializePlatform();
  if (isTauri()) {
    const { initDesktopMenu } = await import('@/platform/desktopMenu');
    await initDesktopMenu();
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();