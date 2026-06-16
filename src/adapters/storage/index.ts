import { isWeb } from '@/platform/detect';
import type { StorageAdapter } from './types';
import { createTauriStorageAdapter } from './tauriStorage';
import { createWebStorageAdapter } from './webStorage';

let storageAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!storageAdapter) {
    storageAdapter = isWeb() ? createWebStorageAdapter() : createTauriStorageAdapter();
  }
  return storageAdapter;
}

export function resetStorageAdapterForTests(): void {
  storageAdapter = null;
}

export type { DirEntry, StorageAdapter } from './types';
