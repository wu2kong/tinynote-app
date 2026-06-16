import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializePlatform } from '@/platform/init';
import './styles/themes/index.css';
import './styles/global.css';

async function bootstrap() {
  await initializePlatform();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();