export type Platform = 'desktop' | 'mobile' | 'web';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  }
}

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__TAURI_INTERNALS__ ?? window.__TAURI__);
}

export function isWeb(): boolean {
  return !isTauri();
}

export function isMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function getPlatform(): Platform {
  if (isWeb()) {
    return isMobileUserAgent() ? 'mobile' : 'web';
  }
  return isMobileUserAgent() ? 'mobile' : 'desktop';
}

/**
 * Web 端：isomorphic-git + CORS 代理（仅 HTTPS）。
 * 桌面/移动 Tauri：默认系统 git（支持 SSH / Gitea 等），可通过 VITE_SYNC_BACKEND=isomorphic-git 覆盖。
 */
export function getSyncBackend(): 'isomorphic-git' | 'tauri-rust' {
  const override = import.meta.env.VITE_SYNC_BACKEND;
  if (override === 'isomorphic-git') return 'isomorphic-git';
  if (override === 'tauri-rust' && isTauri()) return 'tauri-rust';
  if (isTauri()) return 'tauri-rust';
  return 'isomorphic-git';
}
