import { getSyncAdapter } from '@/adapters/sync';
import type {
  FileDiff,
  GitChangedFile,
  GitChangeType,
  GitSyncStatus,
} from '@/adapters/sync';
import { assertNetworkAvailable, TimeoutError, withTimeout } from '@/utils/async';

export type { FileDiff, GitChangedFile, GitChangeType, GitSyncStatus };

const SYNC_NETWORK_TIMEOUT_MS = 60_000;
const SYNC_TIMEOUT_MESSAGE = '同步操作超时（60 秒），请检查网络连接后重试';

export function formatSyncError(error: unknown, fallback: string): string {
  if (error instanceof TimeoutError) {
    return error.message;
  }

  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : fallback;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return '当前处于离线状态，请检查网络连接';
  }

  if (
    /timeout|timed out|超时|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|Could not resolve|Could not connect|Failed to connect|network|fetch failed|Load failed|unable to access/i.test(message)
  ) {
    return '网络连接失败或响应超时，请检查网络后重试';
  }

  return message || fallback;
}

async function runSyncNetworkOperation<T>(operation: () => Promise<T>): Promise<T> {
  assertNetworkAvailable();
  return withTimeout(operation(), SYNC_NETWORK_TIMEOUT_MS, SYNC_TIMEOUT_MESSAGE);
}

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
  return runSyncNetworkOperation(() => getSyncAdapter().gitPull(storagePath));
}

export async function gitSyncPush(storagePath: string): Promise<string> {
  return runSyncNetworkOperation(() => getSyncAdapter().gitSyncPush(storagePath));
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
