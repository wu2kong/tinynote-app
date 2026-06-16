import { joinPath, normalizePath } from '@/utils/path';
import type { StorageAdapter } from '@/adapters/storage/types';

type FsStat = {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
  mode?: number;
  size?: number;
};

function resolvePath(rootDir: string, filepath: string): string {
  const root = normalizePath(rootDir);
  const normalized = normalizePath(filepath);
  if (normalized === root || normalized.startsWith(`${root}/`)) {
    return normalized;
  }
  // isomorphic-git 向上查找 .git 时会传入笔记库目录之外的绝对路径，需原样保留
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    return normalized;
  }
  return joinPath(root, normalized);
}

export function createGitFsFromStorage(storage: StorageAdapter, rootDir: string) {
  const root = normalizePath(rootDir);

  async function stat(filepath: string): Promise<FsStat> {
    const resolved = resolvePath(root, filepath);
    try {
      const info = await storage.stat(resolved);
      return {
        isFile: () => info.isFile,
        isDirectory: () => info.isDirectory,
        isSymbolicLink: () => false,
        mode: info.isDirectory ? 0o40755 : 0o100644,
      };
    } catch {
      throw new Error(`ENOENT: no such file or directory, stat '${filepath}'`);
    }
  }

  return {
    promises: {
      async readFile(filepath: string, options?: { encoding?: string }) {
        const resolved = resolvePath(root, filepath);
        const content = await storage.readTextFile(resolved);
        if (options?.encoding === 'utf8') return content;
        return new TextEncoder().encode(content);
      },

      async writeFile(filepath: string, data: string | Uint8Array, options?: { encoding?: string }) {
        const resolved = resolvePath(root, filepath);
        const parent = resolved.slice(0, resolved.lastIndexOf('/'));
        if (parent && parent !== resolved) {
          try {
            await storage.mkdir(parent, true);
          } catch {
            // exists
          }
        }
        const text = typeof data === 'string'
          ? data
          : new TextDecoder(options?.encoding ?? 'utf8').decode(data);
        await storage.writeTextFile(resolved, text);
      },

      async mkdir(filepath: string, options?: { recursive?: boolean }) {
        await storage.mkdir(resolvePath(root, filepath), options?.recursive ?? false);
      },

      async rmdir(filepath: string) {
        await storage.remove(resolvePath(root, filepath), false);
      },

      async readdir(filepath: string) {
        const resolved = resolvePath(root, filepath);
        const entries = await storage.readDir(resolved);
        return entries.map((entry) => entry.name).filter(Boolean);
      },

      stat,

      lstat(filepath: string) {
        return stat(filepath);
      },

      async unlink(filepath: string) {
        await storage.remove(resolvePath(root, filepath), false);
      },

      async rename(oldPath: string, newPath: string) {
        await storage.rename(resolvePath(root, oldPath), resolvePath(root, newPath));
      },
    },
  };
}

export function repoRelativePath(rootDir: string, absoluteOrRelative: string): string {
  const root = normalizePath(rootDir);
  const abs = resolvePath(rootDir, absoluteOrRelative);
  if (abs === root) return '';
  if (abs.startsWith(`${root}/`)) {
    return abs.slice(root.length + 1);
  }
  return abs;
}

export { resolvePath as resolveGitPath };
