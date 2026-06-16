import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { getStorageAdapter } from '@/adapters/storage';
import { getWebLightningFs } from '@/adapters/storage/webStorage';
import { isWeb } from '@/platform/detect';
import { joinPath, normalizePath } from '@/utils/path';
import { loadSyncRuntimeOptions } from '@/adapters/sync/runtime';
import { createGitFsFromStorage, repoRelativePath } from './gitFs';
import type {
  FileDiff,
  GitChangedFile,
  GitChangeType,
  GitSyncStatus,
  SyncAdapter,
} from './types';

const DEFAULT_CORS_PROXY = 'https://cors.isomorphic-git.org';

function getHostname(): string {
  return isWeb() ? 'tinynote-web' : 'tinynote-desktop';
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
    throw new Error('当前笔记库目录不是 Git 仓库，请先在目录中初始化 Git。');
  }
  return root;
}

function mapMatrixStatus(headStatus: number, workdirStatus: number, stageStatus: number): GitChangeType | null {
  if (headStatus === 0 && workdirStatus === 0 && stageStatus === 0) return null;
  if (headStatus === 0 && workdirStatus === 2) return 'added';
  if (headStatus === 1 && workdirStatus === 2 && stageStatus === 2) return 'deleted';
  if (workdirStatus === 2 || stageStatus === 2) return 'modified';
  if (headStatus === 0) return 'added';
  return 'modified';
}

async function collectChangedMdFiles(dir: string): Promise<GitChangedFile[]> {
  const matrix = await git.statusMatrix({ fs: getGitFs(dir), dir });
  const files: GitChangedFile[] = [];

  for (const [filepath, head, workdir, stage] of matrix) {
    if (!isMdFile(filepath)) continue;
    const changeType = mapMatrixStatus(head, workdir, stage);
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

async function getHttpOptions() {
  const options = await loadSyncRuntimeOptions();
  return {
    http,
    corsProxy: options.corsProxy || DEFAULT_CORS_PROXY,
    onAuth: options.auth
      ? async () => options.auth!
      : undefined,
  };
}

export function createIsomorphicGitSyncAdapter(): SyncAdapter {
  return {
    async getGitStatus(storagePath: string): Promise<GitSyncStatus> {
      const hostname = getHostname();
      const dir = normalizePath(storagePath);

      if (!(await getStorageAdapter().exists(dir))) {
        return {
          isRepo: false,
          remoteUrl: null,
          branch: null,
          changedMdCount: 0,
          changedFiles: [],
          ahead: 0,
          behind: 0,
          hasRemote: false,
          hostname,
          statusError: '笔记库目录不存在',
        };
      }

      if (!(await isGitRepo(dir))) {
        return {
          isRepo: false,
          remoteUrl: null,
          branch: null,
          changedMdCount: 0,
          changedFiles: [],
          ahead: 0,
          behind: 0,
          hasRemote: false,
          hostname,
          statusError: null,
        };
      }

      const repoDir = await getRepoDir(dir);

      try {
        const remotes = await git.listRemotes({ fs: getGitFs(repoDir), dir: repoDir });
        const origin = remotes.find((remote) => remote.remote === 'origin') ?? remotes[0];
        const branch = await git.currentBranch({ fs: getGitFs(repoDir), dir: repoDir, fullname: false }) ?? 'main';
        const changedFiles = await collectChangedMdFiles(repoDir);
        const { ahead, behind } = origin
          ? await countAheadBehind(repoDir, origin.remote, branch)
          : { ahead: 0, behind: 0 };

        return {
          isRepo: true,
          remoteUrl: origin?.url ?? null,
          branch,
          changedMdCount: changedFiles.length,
          changedFiles,
          ahead,
          behind,
          hasRemote: Boolean(origin?.url),
          hostname,
          statusError: null,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : '读取 Git 状态失败';
        return {
          isRepo: true,
          remoteUrl: null,
          branch: null,
          changedMdCount: 0,
          changedFiles: [],
          ahead: 0,
          behind: 0,
          hasRemote: false,
          hostname,
          statusError: message,
        };
      }
    },

    async gitPull(storagePath: string): Promise<void> {
      const dir = await getRepoDir(storagePath);
      const branch = await git.currentBranch({ fs: getGitFs(dir), dir, fullname: false }) ?? 'main';
      const httpOptions = await getHttpOptions();

      await git.pull({
        fs: getGitFs(dir),
        dir,
        ref: branch,
        singleBranch: true,
        author: { name: getHostname(), email: 'tinynote@local' },
        committer: { name: getHostname(), email: 'tinynote@local' },
        ...httpOptions,
      });
    },

    async gitSyncPush(storagePath: string): Promise<string> {
      const dir = await getRepoDir(storagePath);
      const changedFiles = await collectChangedMdFiles(dir);
      if (changedFiles.length === 0) {
        throw new Error('没有需要提交的内容');
      }

      const fs = getGitFs(dir);
      for (const file of changedFiles) {
        if (file.changeType === 'deleted') {
          await git.remove({ fs, dir, filepath: file.path });
        } else {
          await git.add({ fs, dir, filepath: file.path });
        }
      }

      const hostname = getHostname();
      const message = `${hostname} sync push`;
      await git.commit({
        fs,
        dir,
        message,
        author: { name: hostname, email: 'tinynote@local' },
      });

      const branch = await git.currentBranch({ fs, dir, fullname: false }) ?? 'main';
      const httpOptions = await getHttpOptions();
      await git.push({
        fs,
        dir,
        remote: 'origin',
        ref: branch,
        ...httpOptions,
      });

      return message;
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
        const mapped = mapMatrixStatus(row[1], row[2], row[3]);
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
