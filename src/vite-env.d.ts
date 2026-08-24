/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLATFORM: 'web' | 'tauri';
  readonly VITE_APP_VERSION: string;
  readonly VITE_SYNC_BACKEND?: 'isomorphic-git' | 'tauri-rust';
  readonly VITE_GIT_CORS_PROXY?: string;
  readonly VITE_GITHUB_OAUTH_CLIENT_ID?: string;
  readonly VITE_GITEE_OAUTH_CLIENT_ID?: string;
  readonly VITE_GITLAB_OAUTH_CLIENT_ID?: string;
  readonly VITE_TINYNOTE_GIT_OAUTH_CLIENT_ID?: string;
  readonly VITE_TINYNOTE_GIT_HOST?: string;
  readonly VITE_QINIU_CDN_BASE?: string;
  readonly VITE_TINYNOTE_UPDATE_SOURCE?: 'auto' | 'qiniu' | 'github';
  readonly VITE_DISTRIBUTION?: 'direct' | 'mac-app-store';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
