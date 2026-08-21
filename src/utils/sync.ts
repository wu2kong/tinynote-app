import { getSyncAdapter } from '@/adapters/sync';
import type {
  FileDiff,
  GitChangedFile,
  GitChangeType,
  GitInitResult,
  GitPullOptions,
  GitPushOptions,
  GitPushResult,
  GitRemoteInfo,
  GitSyncStatus,
  SyncAuth,
} from '@/adapters/sync';
import { assertNetworkAvailable, TimeoutError, withTimeout } from '@/utils/async';
import { t } from '@/i18n';

export type {
  FileDiff,
  GitChangedFile,
  GitChangeType,
  GitInitResult,
  GitPullOptions,
  GitPushOptions,
  GitPushResult,
  GitRemoteInfo,
  GitSyncStatus,
  SyncAuth,
};

const SYNC_NETWORK_TIMEOUT_MS = 60_000;
const syncTimeoutMessage = () => t('utils.sync.timeout');

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
    return t('utils.sync.offline');
  }

  if (
    /timeout|timed out|超时|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|Could not resolve|Could not connect|Failed to connect|network|fetch failed|Load failed|unable to access/i.test(message)
  ) {
    return t('utils.sync.networkFailed');
  }

  return message || fallback;
}

async function runSyncNetworkOperation<T>(operation: () => Promise<T>): Promise<T> {
  assertNetworkAvailable();
  return withTimeout(operation(), SYNC_NETWORK_TIMEOUT_MS, syncTimeoutMessage());
}

const DIFF_META_PREFIXES = ['+++', '---', '@@', 'diff ', 'index ', 'new file', 'deleted file'];

function isDiffMetaLine(line: string): boolean {
  return DIFF_META_PREFIXES.some((prefix) => line.startsWith(prefix));
}

export function getDisplayDiffLines(raw: string): string[] {
  return raw.split('\n').filter((line) => line && !isDiffMetaLine(line));
}

export async function getGitStatus(storagePath: string, primaryRemote?: string | null): Promise<GitSyncStatus> {
  return getSyncAdapter().getGitStatus(storagePath, primaryRemote);
}

export async function gitInit(storagePath: string): Promise<GitInitResult> {
  return getSyncAdapter().gitInit(storagePath);
}

export async function listGitRemotes(storagePath: string): Promise<GitRemoteInfo[]> {
  return getSyncAdapter().listRemotes(storagePath);
}

export async function addGitRemote(storagePath: string, name: string, url: string): Promise<void> {
  return getSyncAdapter().addRemote(storagePath, name, url);
}

export async function removeGitRemote(storagePath: string, name: string): Promise<void> {
  return getSyncAdapter().removeRemote(storagePath, name);
}

export async function gitPull(storagePath: string, options?: GitPullOptions): Promise<void> {
  return runSyncNetworkOperation(() => getSyncAdapter().gitPull(storagePath, options));
}

export async function gitSyncPush(storagePath: string, options?: GitPushOptions): Promise<GitPushResult> {
  return runSyncNetworkOperation(() => getSyncAdapter().gitSyncPush(storagePath, options));
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
      return t('utils.sync.added', { path });
    case 'deleted':
      return t('utils.sync.deleted', { path });
    default:
      return t('utils.sync.modified', { path });
  }
}

export function authForRemote(
  remoteName: string,
  authByRemote: Record<string, SyncAuth>,
  fallback?: SyncAuth | null,
): SyncAuth | null {
  return authByRemote[remoteName] ?? fallback ?? null;
}
