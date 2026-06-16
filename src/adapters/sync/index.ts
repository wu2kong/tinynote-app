import { getSyncBackend, isWeb } from '@/platform/detect';
import { createIsomorphicGitSyncAdapter } from './isomorphicGitSync';
import { createTauriRustSyncAdapter } from './tauriSync';
import type { SyncAdapter } from './types';

let syncAdapter: SyncAdapter | null = null;

export function getSyncAdapter(): SyncAdapter {
  if (!syncAdapter) {
    const backend = getSyncBackend();
    syncAdapter = backend === 'tauri-rust' && !isWeb()
      ? createTauriRustSyncAdapter()
      : createIsomorphicGitSyncAdapter();
  }
  return syncAdapter;
}

export function resetSyncAdapterForTests(): void {
  syncAdapter = null;
}

export type {
  FileDiff,
  GitChangedFile,
  GitChangeType,
  GitSyncStatus,
  SyncAdapter,
  SyncAuth,
  SyncRuntimeOptions,
} from './types';
