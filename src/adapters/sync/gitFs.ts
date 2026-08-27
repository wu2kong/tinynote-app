import { joinPath, normalizePath } from '../../utils/path.ts';
import type { StorageAdapter } from '../storage/types.ts';

type FsStat = {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
  mode?: number;
  size?: number;
  mtimeMs?: number;
  ctimeMs?: number;
  mtime?: Date;
  ctime?: Date;
  uid?: number;
  gid?: number;
  ino?: number;
  dev?: number;
};

class FsError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FsError';
    this.code = code;
  }
}

function enoent(syscall: string, filepath: string): FsError {
  return new FsError('ENOENT', `ENOENT: no such file or directory, ${syscall} '${filepath}'`);
}

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
      const size = info.size ?? 0;
      const mtimeMs = info.mtimeMs ?? Date.now();
      const mtime = new Date(mtimeMs);
      return {
        isFile: () => info.isFile,
        isDirectory: () => info.isDirectory,
        isSymbolicLink: () => false,
        mode: info.isDirectory ? 0o40755 : 0o100644,
        size,
        mtimeMs,
        ctimeMs: mtimeMs,
        mtime,
        ctime: mtime,
        uid: 0,
        gid: 0,
        ino: 0,
        dev: 0,
      };
    } catch {
      throw enoent('stat', filepath);
    }
  }

  async function ensureParent(resolved: string): Promise<void> {
    const parent = resolved.slice(0, resolved.lastIndexOf('/'));
    if (parent && parent !== resolved) {
      try {
        await storage.mkdir(parent, true);
      } catch {
        // exists
      }
    }
  }

  return {
    promises: {
      async readFile(filepath: string, options?: { encoding?: string }) {
        const resolved = resolvePath(root, filepath);
        try {
          if (options?.encoding === 'utf8') {
            return await storage.readTextFile(resolved);
          }
          const bytes = await storage.readBinaryFile(resolved);
          return bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
        } catch {
          throw enoent('open', filepath);
        }
      },

      async writeFile(
        filepath: string,
        data: string | Uint8Array,
        _options?: { encoding?: string; mode?: number },
      ) {
        const resolved = resolvePath(root, filepath);
        await ensureParent(resolved);
        if (typeof data === 'string') {
          await storage.writeTextFile(resolved, data);
          return;
        }
        await storage.writeBinaryFile(
          resolved,
          data instanceof Uint8Array ? data.slice() : new Uint8Array(data),
        );
      },

      async mkdir(filepath: string, options?: { recursive?: boolean }) {
        const resolved = resolvePath(root, filepath);
        try {
          await storage.mkdir(resolved, options?.recursive ?? false);
        } catch (error) {
          if (await storage.exists(resolved)) return;
          throw error;
        }
      },

      async rmdir(filepath: string) {
        try {
          await storage.remove(resolvePath(root, filepath), false);
        } catch {
          throw enoent('rmdir', filepath);
        }
      },

      async readdir(filepath: string) {
        const resolved = resolvePath(root, filepath);
        try {
          const entries = await storage.readDir(resolved);
          return entries.map((entry) => entry.name).filter(Boolean);
        } catch {
          throw enoent('scandir', filepath);
        }
      },

      stat,

      lstat(filepath: string) {
        return stat(filepath);
      },

      async unlink(filepath: string) {
        try {
          await storage.remove(resolvePath(root, filepath), false);
        } catch {
          throw enoent('unlink', filepath);
        }
      },

      async rename(oldPath: string, newPath: string) {
        const from = resolvePath(root, oldPath);
        const to = resolvePath(root, newPath);
        await ensureParent(to);
        await storage.rename(from, to);
      },

      async chmod(_filepath: string, _mode: number) {
        // Note library files do not need POSIX execute bits.
      },

      async readlink(filepath: string): Promise<string> {
        throw new FsError('EINVAL', `EINVAL: invalid argument, readlink '${filepath}'`);
      },

      async symlink(_target: string, filepath: string) {
        throw new FsError('EPERM', `EPERM: operation not permitted, symlink '${filepath}'`);
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
