import { invoke } from '@tauri-apps/api/core';
import type {
  FileDiff,
  GitInitResult,
  GitPullOptions,
  GitPushOptions,
  GitPushResult,
  GitRemoteInfo,
  GitSyncStatus,
  SyncAdapter,
} from './types';

export function createTauriRustSyncAdapter(): SyncAdapter {
  return {
    getGitStatus(storagePath: string, primaryRemote?: string | null) {
      return invoke<GitSyncStatus>('get_git_status', { storagePath, primaryRemote: primaryRemote ?? null });
    },

    gitInit(storagePath: string) {
      return invoke<GitInitResult>('git_init', { storagePath });
    },

    listRemotes(storagePath: string) {
      return invoke<GitRemoteInfo[]>('git_list_remotes', { storagePath });
    },

    addRemote(storagePath: string, name: string, url: string) {
      return invoke<void>('git_add_remote', { storagePath, name, url });
    },

    removeRemote(storagePath: string, name: string) {
      return invoke<void>('git_remove_remote', { storagePath, name });
    },

    gitPull(storagePath: string, options?: GitPullOptions) {
      return invoke<void>('git_pull', {
        storagePath,
        remote: options?.remote ?? null,
        auth: options?.auth ?? null,
        allowUnrelated: options?.allowUnrelated ?? false,
      });
    },

    gitSyncPush(storagePath: string, options?: GitPushOptions) {
      return invoke<GitPushResult>('git_sync_push', {
        storagePath,
        remotes: options?.remotes ?? null,
        authByRemote: options?.authByRemote ?? null,
      });
    },

    getFileDiff(storagePath: string, filePath: string) {
      return invoke<FileDiff>('get_file_diff', { storagePath, filePath });
    },

    revertFileChange(storagePath: string, filePath: string) {
      return invoke<void>('revert_file_change', { storagePath, filePath });
    },
  };
}
