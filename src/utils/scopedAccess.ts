import { invoke } from '@tauri-apps/api/core';
import { IS_MAC_APP_STORE } from '@/constants/distribution';
import { isTauri } from '@/platform/detect';
import { normalizePath } from '@/utils/path';
import { ensureDefaultMasLibrary } from '@/utils/workspaces';

export interface ScopedAccessState {
  accessible: boolean;
}

export async function persistScopedAccess(path: string): Promise<boolean> {
  if (!isTauri() || !IS_MAC_APP_STORE || !path) return true;
  try {
    await invoke('persist_scoped_access', { path });
    return true;
  } catch (error) {
    console.warn('[tinynote] Failed to persist folder access:', error);
    return false;
  }
}

/** MAS sandbox: pick a folder from NSOpenPanel and persist a security-scoped bookmark. */
export async function pickWorkspaceFolder(): Promise<string | null> {
  if (!isTauri() || !IS_MAC_APP_STORE) return null;
  const selected = await invoke<string | null>('pick_and_persist_workspace_folder');
  return selected ? selected : null;
}

const ENSURE_ACCESS_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export async function ensureScopedAccess(path: string): Promise<ScopedAccessState> {
  if (!isTauri() || !IS_MAC_APP_STORE || !path) return { accessible: true };
  try {
    return await withTimeout(
      invoke<ScopedAccessState>('ensure_scoped_access', { path }),
      ENSURE_ACCESS_TIMEOUT_MS,
      { accessible: true },
    );
  } catch (error) {
    console.warn('[tinynote] Failed to restore folder access:', error);
    return { accessible: true };
  }
}

/** If a saved MAS library is unreadable, keep the app usable via the sandbox default library. */
export async function resolveAccessibleWorkspacePath(path: string): Promise<string> {
  const normalized = normalizePath(path);
  const access = await ensureScopedAccess(normalized);
  if (access.accessible) return normalized;
  try {
    const fallback = normalizePath(await ensureDefaultMasLibrary());
    if (fallback !== normalized) {
      console.warn('[tinynote] Falling back to Mac App Store default library:', fallback);
      return fallback;
    }
  } catch (error) {
    console.warn('[tinynote] Default library fallback failed:', error);
  }
  return normalized;
}
