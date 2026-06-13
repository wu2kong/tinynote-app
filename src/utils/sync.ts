import { invoke } from '@tauri-apps/api/core';

export type GitChangeType = 'added' | 'modified' | 'deleted';

export interface GitChangedFile {
  path: string;
  changeType: GitChangeType;
}

export interface GitSyncStatus {
  isRepo: boolean;
  remoteUrl: string | null;
  branch: string | null;
  changedMdCount: number;
  changedFiles: GitChangedFile[];
  ahead: number;
  behind: number;
  hasRemote: boolean;
  hostname: string;
  statusError: string | null;
}

export interface FileDiff {
  diff: string;
  changeType: string;
  isNewFile: boolean;
}

const DIFF_META_PREFIXES = ['+++', '---', '@@', 'diff ', 'index ', 'new file', 'deleted file'];

function isDiffMetaLine(line: string): boolean {
  return DIFF_META_PREFIXES.some((prefix) => line.startsWith(prefix));
}

export function getDisplayDiffLines(raw: string): string[] {
  return raw.split('\n').filter((line) => line && !isDiffMetaLine(line));
}

export async function getGitStatus(storagePath: string): Promise<GitSyncStatus> {
  return invoke<GitSyncStatus>('get_git_status', { storagePath });
}

export async function gitPull(storagePath: string): Promise<void> {
  return invoke<void>('git_pull', { storagePath });
}

export async function gitSyncPush(storagePath: string): Promise<string> {
  return invoke<string>('git_sync_push', { storagePath });
}

export async function getFileDiff(storagePath: string, filePath: string): Promise<FileDiff> {
  return invoke<FileDiff>('get_file_diff', { storagePath, filePath });
}

export async function revertFileChange(storagePath: string, filePath: string): Promise<void> {
  return invoke<void>('revert_file_change', { storagePath, filePath });
}

export function formatSyncCommitMessage(hostname: string): string {
  return `${hostname} sync push`;
}

export function getChangeBadge(changeType: GitChangeType): 'A' | 'M' | 'D' {
  switch (changeType) {
    case 'added':
      return 'A';
    case 'deleted':
      return 'D';
    default:
      return 'M';
  }
}

export function getChangeTooltip(changeType: GitChangeType, path: string): string {
  switch (changeType) {
    case 'added':
      return `新增：${path}`;
    case 'deleted':
      return `删除：${path}`;
    default:
      return `变更：${path}`;
  }
}
