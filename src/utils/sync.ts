import { getSyncAdapter } from '@/adapters/sync';
import type {
  FileDiff,
  GitChangedFile,
  GitChangeType,
  GitSyncStatus,
} from '@/adapters/sync';

export type { FileDiff, GitChangedFile, GitChangeType, GitSyncStatus };

const DIFF_META_PREFIXES = ['+++', '---', '@@', 'diff ', 'index ', 'new file', 'deleted file'];

function isDiffMetaLine(line: string): boolean {
  return DIFF_META_PREFIXES.some((prefix) => line.startsWith(prefix));
}

export function getDisplayDiffLines(raw: string): string[] {
  return raw.split('\n').filter((line) => line && !isDiffMetaLine(line));
}

export async function getGitStatus(storagePath: string): Promise<GitSyncStatus> {
  return getSyncAdapter().getGitStatus(storagePath);
}

export async function gitPull(storagePath: string): Promise<void> {
  return getSyncAdapter().gitPull(storagePath);
}

export async function gitSyncPush(storagePath: string): Promise<string> {
  return getSyncAdapter().gitSyncPush(storagePath);
}

export async function getFileDiff(storagePath: string, filePath: string): Promise<FileDiff> {
  return getSyncAdapter().getFileDiff(storagePath, filePath);
}

export async function revertFileChange(storagePath: string, filePath: string): Promise<void> {
  return getSyncAdapter().revertFileChange(storagePath, filePath);
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
