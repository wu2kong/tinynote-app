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
 * 桌面 / Web 都使用内置 isomorphic-git，不依赖系统 Git。
 * 网页端走 CORS 代理；桌面端走 Tauri 原生 HTTP。
 * 可用 VITE_SYNC_BACKEND=tauri-rust 临时回退到系统 Git（仅桌面调试）。
 */
export function getSyncBackend(): 'isomorphic-git' | 'tauri-rust' {
  const override = import.meta.env.VITE_SYNC_BACKEND;
  if (override === 'tauri-rust' && isTauri()) return 'tauri-rust';
  return 'isomorphic-git';
}
