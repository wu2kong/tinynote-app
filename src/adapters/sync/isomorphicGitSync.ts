import '@/polyfills/nodeBuffer';
import git from 'isomorphic-git';
import { invoke } from '@tauri-apps/api/core';
import { getStorageAdapter } from '@/adapters/storage';
import { getWebLightningFs } from '@/adapters/storage/webStorage';
import { isWeb } from '@/platform/detect';
import { joinPath, normalizePath } from '@/utils/path';
import { loadSyncRuntimeOptions } from '@/adapters/sync/runtime';
import { t } from '@/i18n';
import { allocateConflictCopyPath } from '@/utils/syncConflictName';
import { createGitFsFromStorage, repoRelativePath } from './gitFs';
import { TINYNOTE_GITIGNORE } from './gitignore';
import { getGitHttpClient } from './gitHttpClient';
import { toHttpsRemoteUrl } from './gitProviders';
import { mapMatrixStatus } from './gitStatusMatrix';
import type {
  FileDiff,
  GitChangedFile,
  GitChangeType,
  GitInitResult,
  GitPullOptions,
  GitPullResult,
  GitPushOptions,
  GitPushResult,
  GitRemoteInfo,
  GitSyncStatus,
  SyncAdapter,
  SyncAuth,
} from './types';

const DEFAULT_CORS_PROXY = 'https://cors.isomorphic-git.org';

let cachedHostname: string | null = null;

async function resolveHostname(): Promise<string> {
  if (isWeb()) return 'tinynote-web';
  if (cachedHostname) return cachedHostname;
  try {
    const name = (await invoke<string>('get_hostname')).trim();
    cachedHostname = name || 'tinynote-desktop';
  } catch {
    cachedHostname = 'tinynote-desktop';
  }
  return cachedHostname;
}

function isMdFile(path: string): boolean {
  return path.toLowerCase().endsWith('.md');
}

function getGitFs(storagePath: string) {
  if (isWeb()) {
    return getWebLightningFs().promises;
  }
  return createGitFsFromStorage(getStorageAdapter(), storagePath).promises;
}

async function findGitRootPath(storagePath: string): Promise<string | null> {
  const dir = normalizePath(storagePath);
  const storage = getStorageAdapter();

  try {
    return await git.findRoot({ fs: getGitFs(dir), filepath: dir });
  } catch {
    // 兜底：沿目录向上查找 .git（兼容 git 根目录在笔记库父级的情况）
    let current = dir;
    while (current) {
      const dotGit = joinPath(current, '.git');
      if (await storage.exists(dotGit)) {
        return current;
      }
      const parent = current.replace(/\/[^/]+$/, '');
      if (!parent || parent === current) break;
      current = parent;
    }
    return null;
  }
}

async function isGitRepo(storagePath: string): Promise<boolean> {
  return (await findGitRootPath(storagePath)) !== null;
}

async function getRepoDir(storagePath: string): Promise<string> {
  const root = await findGitRootPath(storagePath);
  if (!root) {
    throw new Error(t('utils.sync.notGitRepo'));
  }
  return root;
}

async function collectChangedMdFiles(dir: string): Promise<GitChangedFile[]> {
  const matrix = await git.statusMatrix({ fs: getGitFs(dir), dir });
  const files: GitChangedFile[] = [];

  for (const [filepath, head, workdir] of matrix) {
    if (!isMdFile(filepath)) continue;
    const changeType = mapMatrixStatus(head, workdir);
    if (!changeType) continue;
    files.push({ path: filepath, changeType });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

async function countAheadBehind(dir: string, remote: string, ref: string): Promise<{ ahead: number; behind: number }> {
  try {
    const localLog = await git.log({ fs: getGitFs(dir), dir, ref, depth: 100 });
    const remoteLog = await git.log({ fs: getGitFs(dir), dir, ref: `refs/remotes/${remote}/${ref}`, depth: 100 });
    const remoteSet = new Set(remoteLog.map((entry) => entry.oid));

    let ahead = 0;
    for (const entry of localLog) {
      if (remoteSet.has(entry.oid)) break;
      ahead += 1;
    }

    const localSet = new Set(localLog.map((entry) => entry.oid));
    let behind = 0;
    for (const entry of remoteLog) {
      if (localSet.has(entry.oid)) break;
      behind += 1;
    }

    return { ahead, behind };
  } catch {
    return { ahead: 0, behind: 0 };
  }
}

async function getHttpOptions(auth?: SyncAuth | null) {
  const options = await loadSyncRuntimeOptions();
  const resolved = auth ?? options.auth;
  return {
    http: getGitHttpClient(),
    ...(isWeb() ? { corsProxy: options.corsProxy || DEFAULT_CORS_PROXY } : {}),
    onAuth: resolved
      ? async () => resolved
      : undefined,
  };
}

async function ensureHttpsRemotes(dir: string): Promise<void> {
  const fs = getGitFs(dir);
  const remotes = await git.listRemotes({ fs, dir });
  for (const remote of remotes) {
    if (!remote.remote) continue;
    const https = toHttpsRemoteUrl(remote.url);
    if (https === remote.url) continue;
    await git.deleteRemote({ fs, dir, remote: remote.remote });
    await git.addRemote({ fs, dir, remote: remote.remote, url: https });
  }
}

async function listRepoRemotes(dir: string): Promise<GitRemoteInfo[]> {
  const remotes = await git.listRemotes({ fs: getGitFs(dir), dir });
  const seen = new Set<string>();
  const result: GitRemoteInfo[] = [];
  for (const remote of remotes) {
    if (!remote.remote || seen.has(remote.remote)) continue;
    seen.add(remote.remote);
    result.push({ name: remote.remote, url: remote.url });
  }
  return result;
}

function pickPrimaryRemote(remotes: GitRemoteInfo[], primaryRemote?: string | null): GitRemoteInfo | null {
  if (primaryRemote) {
    const match = remotes.find((remote) => remote.name === primaryRemote);
    if (match) return match;
  }
  return remotes.find((remote) => remote.name === 'origin') ?? remotes[0] ?? null;
}

async function ensureGitignore(dir: string): Promise<void> {
  const ignorePath = joinPath(dir, '.gitignore');
  if (!(await getStorageAdapter().exists(ignorePath))) {
    await getStorageAdapter().writeTextFile(ignorePath, TINYNOTE_GITIGNORE);
  }
}

async function ensureGitIdentity(dir: string): Promise<void> {
  await git.setConfig({ fs: getGitFs(dir), dir, path: 'user.name', value: 'TinyNote' });
  await git.setConfig({ fs: getGitFs(dir), dir, path: 'user.email', value: 'tinynote@local' });
}

async function currentBranchName(dir: string): Promise<string> {
  return await git.currentBranch({ fs: getGitFs(dir), dir, fullname: false }) ?? 'main';
}

function isMergeConflictError(error: unknown): error is {
  code: string;
  data?: {
    filepaths?: string[];
    bothModified?: string[];
    deleteByUs?: string[];
    deleteByTheirs?: string[];
  };
} {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'MergeConflictError';
}

async function readFileAtOid(dir: string, oid: string, filepath: string): Promise<string | null> {
  try {
    const { blob } = await git.readBlob({ fs: getGitFs(dir), dir, oid, filepath });
    return new TextDecoder().decode(blob);
  } catch {
    return null;
  }
}

async function writeConflictCopy(
  dir: string,
  originalPath: string,
  content: string,
  suffix: string,
  copies: string[],
): Promise<string | null> {
  if (!originalPath || originalPath.startsWith('.git/') || originalPath === '.git') return null;
  const storage = getStorageAdapter();
  const copyPath = await allocateConflictCopyPath(
    originalPath,
    suffix,
    (candidate) => storage.exists(joinPath(dir, candidate)),
  );
  const absolute = joinPath(dir, copyPath);
  const parent = absolute.slice(0, absolute.lastIndexOf('/'));
  if (parent && parent !== absolute) {
    try {
      await storage.mkdir(parent, true);
    } catch {
      // exists
    }
  }
  await storage.writeTextFile(absolute, content);
  copies.push(copyPath);
  return copyPath;
}

async function protectDirtyFiles(
  dir: string,
  headOid: string | null,
  theirOid: string,
  suffix: string,
  copies: string[],
): Promise<void> {
  if (!headOid) return;
  const fs = getGitFs(dir);
  const storage = getStorageAdapter();
  const matrix = await git.statusMatrix({ fs, dir });

  for (const [filepath, head, workdir] of matrix) {
    const locallyDirty = workdir === 2 || (head === 1 && workdir === 0);
    if (!locallyDirty) continue;

    const headContent = head === 0 ? null : await readFileAtOid(dir, headOid, filepath);
    const theirContent = await readFileAtOid(dir, theirOid, filepath);
    if (headContent === theirContent) continue;

    const absolute = joinPath(dir, filepath);
    const workContent = workdir === 0
      ? null
      : await storage.exists(absolute) ? await storage.readTextFile(absolute) : null;

    if (workContent != null && workContent !== theirContent) {
      await writeConflictCopy(dir, filepath, workContent, suffix, copies);
    }

    if (headContent == null) {
      if (await storage.exists(absolute)) {
        await storage.remove(absolute, false);
      }
    } else {
      await git.checkout({ fs, dir, ref: 'HEAD', filepaths: [filepath], force: true });
    }
  }
}

async function completeConflictMerge(
  dir: string,
  branch: string,
  theirOid: string,
  error: {
    data?: {
      filepaths?: string[];
      bothModified?: string[];
      deleteByUs?: string[];
      deleteByTheirs?: string[];
    };
  },
  suffix: string,
  copies: string[],
  author: { name: string; email: string },
): Promise<void> {
  const fs = getGitFs(dir);
  const storage = getStorageAdapter();
  const ourOid = await git.resolveRef({ fs, dir, ref: branch });
  const bothModified = error.data?.bothModified ?? error.data?.filepaths ?? [];
  const deleteByUs = error.data?.deleteByUs ?? [];
  const deleteByTheirs = error.data?.deleteByTheirs ?? [];

  for (const filepath of bothModified) {
    const ours = await readFileAtOid(dir, ourOid, filepath);
    const theirs = await readFileAtOid(dir, theirOid, filepath);
    if (ours != null && ours !== theirs) {
      await writeConflictCopy(dir, filepath, ours, suffix, copies);
    }
    if (theirs != null) {
      await storage.writeTextFile(joinPath(dir, filepath), theirs);
      await git.add({ fs, dir, filepath });
    } else if (await storage.exists(joinPath(dir, filepath))) {
      await storage.remove(joinPath(dir, filepath), false);
      try {
        await git.remove({ fs, dir, filepath });
      } catch {
        // not in index
      }
    }
  }

  for (const filepath of deleteByUs) {
    const theirs = await readFileAtOid(dir, theirOid, filepath);
    if (theirs == null) continue;
    await storage.writeTextFile(joinPath(dir, filepath), theirs);
    await git.add({ fs, dir, filepath });
  }

  for (const filepath of deleteByTheirs) {
    const ours = await readFileAtOid(dir, ourOid, filepath);
    if (ours != null) {
      await writeConflictCopy(dir, filepath, ours, suffix, copies);
    }
    if (await storage.exists(joinPath(dir, filepath))) {
      await storage.remove(joinPath(dir, filepath), false);
    }
    try {
      await git.remove({ fs, dir, filepath });
    } catch {
      // already removed
    }
  }

  for (const copyPath of copies) {
    if (await storage.exists(joinPath(dir, copyPath))) {
      await git.add({ fs, dir, filepath: copyPath });
    }
  }

  await git.commit({
    fs,
    dir,
    ref: branch,
    message: `Merge remote-tracking branch into ${branch}`,
    parent: [ourOid, theirOid],
    author,
    committer: author,
  });
}

async function commitConflictCopies(
  dir: string,
  copies: string[],
  author: { name: string; email: string },
): Promise<void> {
  if (copies.length === 0) return;
  const fs = getGitFs(dir);
  const storage = getStorageAdapter();
  let staged = false;
  for (const copyPath of copies) {
    if (!(await storage.exists(joinPath(dir, copyPath)))) continue;
    await git.add({ fs, dir, filepath: copyPath });
    staged = true;
  }
  if (!staged) return;
  try {
    await git.commit({
      fs,
      dir,
      message: 'Keep local notes from sync conflict',
      author,
      committer: author,
    });
  } catch {
    // Nothing new to commit.
  }
}

async function listChangedFilepaths(dir: string, oldOid: string | null, newOid: string): Promise<Set<string>> {
  const files = new Set<string>();
  if (!oldOid || oldOid === newOid) return files;
  await git.walk({
    fs: getGitFs(dir),
    dir,
    trees: [git.TREE({ ref: oldOid }), git.TREE({ ref: newOid })],
    map: async (filepath, [before, after]) => {
      if (!filepath || filepath === '.') return;
      const beforeType = before ? await before.type() : null;
      const afterType = after ? await after.type() : null;
      if (beforeType === 'tree' && afterType === 'tree') return;
      const beforeOid = before ? await before.oid() : null;
      const afterOid = after ? await after.oid() : null;
      if (beforeOid !== afterOid) files.add(filepath);
    },
  });
  return files;
}

type DirtySnapshot = { filepath: string; content: string | null };

async function snapshotDirtyExcept(dir: string, except: Set<string>): Promise<DirtySnapshot[]> {
  const fs = getGitFs(dir);
  const storage = getStorageAdapter();
  const matrix = await git.statusMatrix({ fs, dir });
  const snap: DirtySnapshot[] = [];
  for (const [filepath, head, workdir] of matrix) {
    if (except.has(filepath)) continue;
    const dirty = workdir === 2 || (head === 1 && workdir === 0);
    if (!dirty) continue;
    const absolute = joinPath(dir, filepath);
    const content = workdir === 0 || !(await storage.exists(absolute))
      ? null
      : await storage.readTextFile(absolute);
    snap.push({ filepath, content });
  }
  return snap;
}

async function restoreDirtySnapshot(dir: string, snap: DirtySnapshot[]): Promise<void> {
  const storage = getStorageAdapter();
  for (const { filepath, content } of snap) {
    const absolute = joinPath(dir, filepath);
    if (content == null) {
      if (await storage.exists(absolute)) {
        await storage.remove(absolute, false);
      }
    } else {
      await storage.writeTextFile(absolute, content);
    }
  }
}

function emptyStatus(hostname: string, error: string | null): GitSyncStatus {
  return {
    isRepo: false,
    remotes: [],
    remoteUrl: null,
    primaryRemote: null,
    branch: null,
    changedMdCount: 0,
    changedFiles: [],
    ahead: 0,
    behind: 0,
    hasRemote: false,
    hostname,
    statusError: error,
  };
}

export function createIsomorphicGitSyncAdapter(): SyncAdapter {
  return {
    async getGitStatus(storagePath: string, primaryRemote?: string | null): Promise<GitSyncStatus> {
      const hostname = await resolveHostname();
      const dir = normalizePath(storagePath);

      if (!(await getStorageAdapter().exists(dir))) {
        return emptyStatus(hostname, t('utils.sync.libraryMissing'));
      }

      if (!(await isGitRepo(dir))) {
        return emptyStatus(hostname, null);
      }

      const repoDir = await getRepoDir(dir);
      await ensureHttpsRemotes(repoDir);

      try {
        const remotes = await listRepoRemotes(repoDir);
        const origin = pickPrimaryRemote(remotes, primaryRemote);
        const branch = await currentBranchName(repoDir);
        const changedFiles = await collectChangedMdFiles(repoDir);
        const { ahead, behind } = origin
          ? await countAheadBehind(repoDir, origin.name, branch)
          : { ahead: 0, behind: 0 };

        return {
          isRepo: true,
          remotes,
          remoteUrl: origin?.url ?? null,
          primaryRemote: origin?.name ?? null,
          branch,
          changedMdCount: changedFiles.length,
          changedFiles,
          ahead,
          behind,
          hasRemote: remotes.length > 0,
          hostname,
          statusError: null,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : t('settings.sync.readStatusFailed');
        return {
          ...emptyStatus(hostname, message),
          isRepo: true,
        };
      }
    },

    async gitInit(storagePath: string): Promise<GitInitResult> {
      const dir = normalizePath(storagePath);
      if (await isGitRepo(dir)) {
        return { created: false, branch: await currentBranchName(await getRepoDir(dir)) };
      }

      const fs = getGitFs(dir);
      await git.init({ fs, dir, defaultBranch: 'main' });
      await ensureGitIdentity(dir);
      await ensureGitignore(dir);
      try {
        await git.add({ fs, dir, filepath: '.gitignore' });
        await git.commit({
          fs,
          dir,
          message: 'Initialize TinyNote library',
          author: { name: 'TinyNote', email: 'tinynote@local' },
        });
      } catch {
        // Initial commit is best-effort; first push can still create it.
      }
      return { created: true, branch: 'main' };
    },

    async listRemotes(storagePath: string): Promise<GitRemoteInfo[]> {
      if (!(await isGitRepo(storagePath))) return [];
      const dir = await getRepoDir(storagePath);
      await ensureHttpsRemotes(dir);
      return listRepoRemotes(dir);
    },

    async addRemote(storagePath: string, name: string, url: string): Promise<void> {
      const dir = await getRepoDir(storagePath);
      const fs = getGitFs(dir);
      const https = toHttpsRemoteUrl(url);
      const remotes = await listRepoRemotes(dir);
      if (remotes.some((remote) => remote.name === name)) {
        await git.deleteRemote({ fs, dir, remote: name });
      }
      await git.addRemote({ fs, dir, remote: name, url: https });
    },

    async removeRemote(storagePath: string, name: string): Promise<void> {
      const dir = await getRepoDir(storagePath);
      await git.deleteRemote({ fs: getGitFs(dir), dir, remote: name });
    },

    async gitPull(storagePath: string, options?: GitPullOptions): Promise<GitPullResult> {
      const dir = await getRepoDir(storagePath);
      await ensureHttpsRemotes(dir);
      const branch = await currentBranchName(dir);
      const remotes = await listRepoRemotes(dir);
      const remote = pickPrimaryRemote(remotes, options?.remote)?.name ?? 'origin';
      const httpOptions = await getHttpOptions(options?.auth);
      const suffix = options?.conflictCopySuffix || t('settings.sync.conflictCopySuffix', { date: 'conflict' });
      const author = { name: await resolveHostname(), email: 'tinynote@local' };
      const fs = getGitFs(dir);
      const copies: string[] = [];

      const fetchResult = await git.fetch({
        fs,
        dir,
        remote,
        ref: branch,
        singleBranch: true,
        ...httpOptions,
      });
      if (!fetchResult.fetchHead) {
        return { conflictCopies: [] };
      }

      let headOid: string | null = null;
      try {
        headOid = await git.resolveRef({ fs, dir, ref: branch });
      } catch {
        headOid = null;
      }

      await protectDirtyFiles(dir, headOid, fetchResult.fetchHead, suffix, copies);

      try {
        await git.merge({
          fs,
          dir,
          ours: branch,
          theirs: fetchResult.fetchHead,
          author,
          committer: author,
          abortOnConflict: false,
          allowUnrelatedHistories: options?.allowUnrelated ?? false,
          mergeDriver: async ({ path, contents }) => {
            const ours = contents[1] ?? '';
            const theirs = contents[2] ?? ours;
            if (ours && ours !== theirs) {
              await writeConflictCopy(dir, path, ours, suffix, copies);
            }
            return { cleanMerge: true, mergedText: theirs };
          },
        });
      } catch (error) {
        if (!isMergeConflictError(error)) throw error;
        await completeConflictMerge(dir, branch, fetchResult.fetchHead, error, suffix, copies, author);
      }

      const newOid = await git.resolveRef({ fs, dir, ref: branch });
      const changed = await listChangedFilepaths(dir, headOid, newOid);
      const unrelatedDirty = await snapshotDirtyExcept(dir, changed);
      try {
        await git.checkout({ fs, dir, ref: branch, force: true });
      } catch {
        // Checkout is best-effort; conflict copies are already on disk.
      }
      await restoreDirtySnapshot(dir, unrelatedDirty);

      await commitConflictCopies(dir, copies, author);
      return { conflictCopies: copies };
    },

    async gitSyncPush(storagePath: string, options?: GitPushOptions): Promise<GitPushResult> {
      const dir = await getRepoDir(storagePath);
      await ensureHttpsRemotes(dir);
      const changedFiles = await collectChangedMdFiles(dir);
      const fs = getGitFs(dir);
      const hostname = await resolveHostname();
      let message = `${hostname} sync push`;

      if (changedFiles.length > 0) {
        for (const file of changedFiles) {
          if (file.changeType === 'deleted') {
            await git.remove({ fs, dir, filepath: file.path });
          } else {
            await git.add({ fs, dir, filepath: file.path });
          }
        }
        await git.commit({
          fs,
          dir,
          message,
          author: { name: hostname, email: 'tinynote@local' },
        });
      }

      const remotes = await listRepoRemotes(dir);
      const targetNames = options?.remotes?.length
        ? options.remotes
        : remotes.map((remote) => remote.name);
      if (targetNames.length === 0) {
        throw new Error(t('utils.sync.nothingToCommit'));
      }

      const branch = await currentBranchName(dir);
      const results: GitPushResult['results'] = [];
      for (const remote of targetNames) {
        const auth = options?.authByRemote?.[remote] ?? null;
        try {
          await git.push({
            fs,
            dir,
            remote,
            ref: branch,
            ...(await getHttpOptions(auth)),
          });
          results.push({ remote, ok: true, error: null });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.push({ remote, ok: false, error: errorMessage });
        }
      }

      if (results.every((item) => !item.ok) && changedFiles.length === 0) {
        throw new Error(t('utils.sync.nothingToCommit'));
      }

      return { message, results };
    },

    async getFileDiff(storagePath: string, filePath: string): Promise<FileDiff> {
      const dir = await getRepoDir(storagePath);
      const fs = getGitFs(dir);
      const relative = repoRelativePath(dir, filePath);

      let changeType: GitChangeType = 'modified';
      let isNewFile = false;

      const matrix = await git.statusMatrix({ fs, dir });
      const row = matrix.find(([path]) => path === relative);
      if (row) {
        const mapped = mapMatrixStatus(row[1], row[2]);
        if (mapped) changeType = mapped;
        if (row[1] === 0) isNewFile = true;
      }

      let diff = '';
      try {
        const absolute = joinPath(dir, relative);
        const current = await getStorageAdapter().readTextFile(absolute);
        if (changeType === 'added' || isNewFile) {
          diff = current.split('\n').map((line) => `+${line}`).join('\n');
        } else if (changeType === 'deleted') {
          try {
            const oid = await git.resolveRef({ fs, dir, ref: `HEAD:${relative}` });
            const { blob } = await git.readBlob({ fs, dir, oid });
            diff = new TextDecoder().decode(blob).split('\n').map((line) => `-${line}`).join('\n');
          } catch {
            diff = current.split('\n').map((line) => `-${line}`).join('\n');
          }
        } else {
          try {
            const oid = await git.resolveRef({ fs, dir, ref: `HEAD:${relative}` });
            const { blob } = await git.readBlob({ fs, dir, oid });
            const oldText = new TextDecoder().decode(blob);
            diff = buildLineDiff(oldText, current);
          } catch {
            diff = current.split('\n').map((line) => `+${line}`).join('\n');
          }
        }
      } catch {
        diff = '';
      }

      return { diff, changeType, isNewFile };
    },

    async revertFileChange(storagePath: string, filePath: string): Promise<void> {
      const dir = await getRepoDir(storagePath);
      const fs = getGitFs(dir);
      const relative = repoRelativePath(dir, filePath);
      const absolute = joinPath(dir, relative);

      const matrix = await git.statusMatrix({ fs, dir });
      const row = matrix.find(([path]) => path === relative);
      if (!row) return;

      const [, head] = row;
      if (head === 0) {
        await git.remove({ fs, dir, filepath: relative });
        if (await getStorageAdapter().exists(absolute)) {
          await getStorageAdapter().remove(absolute, false);
        }
        return;
      }

      const oid = await git.resolveRef({ fs, dir, ref: `HEAD:${relative}` });
      const { blob } = await git.readBlob({ fs, dir, oid });
      await getStorageAdapter().writeTextFile(absolute, new TextDecoder().decode(blob));
      await git.checkout({ fs, dir, ref: 'HEAD', filepaths: [relative], force: true });
    },
  };
}

function buildLineDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const lines: string[] = [];
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i += 1) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine === newLine) continue;
    if (oldLine !== undefined) lines.push(`-${oldLine}`);
    if (newLine !== undefined) lines.push(`+${newLine}`);
  }
  return lines.join('\n');
}
