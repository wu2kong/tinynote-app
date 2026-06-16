import { invoke } from '@tauri-apps/api/core';
import type { FileDiff, GitSyncStatus, SyncAdapter } from './types';

export function createTauriRustSyncAdapter(): SyncAdapter {
  return {
    getGitStatus(storagePath: string) {
      return invoke<GitSyncStatus>('get_git_status', { storagePath });
    },

    gitPull(storagePath: string) {
      return invoke<void>('git_pull', { storagePath });
    },

    gitSyncPush(storagePath: string) {
      return invoke<string>('git_sync_push', { storagePath });
    },

    getFileDiff(storagePath: string, filePath: string) {
      return invoke<FileDiff>('get_file_diff', { storagePath, filePath });
    },

    revertFileChange(storagePath: string, filePath: string) {
      return invoke<void>('revert_file_change', { storagePath, filePath });
    },
  };
}
