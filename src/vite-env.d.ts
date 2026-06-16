/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLATFORM: 'web' | 'tauri';
  readonly VITE_APP_VERSION: string;
  readonly VITE_SYNC_BACKEND?: 'isomorphic-git' | 'tauri-rust';
  readonly VITE_GIT_CORS_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}