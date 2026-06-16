import LightningFS from '@isomorphic-git/lightning-fs';
import { normalizePath } from '@/utils/path';
import type { DirEntry, StorageAdapter } from './types';

const FS_NAME = 'tinynote-library';
const DEFAULT_ROOT = '/tinynote-library';

let lightningFs: LightningFS | null = null;

function getLightningFs(): LightningFS {
  if (!lightningFs) {
    lightningFs = new LightningFS(FS_NAME);
  }
  return lightningFs;
}

function getPromises() {
  return getLightningFs().promises;
}

function toVirtualPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === DEFAULT_ROOT || normalized.startsWith(`${DEFAULT_ROOT}/`)) {
    return normalized;
  }
  if (normalized.startsWith('/')) {
    return `${DEFAULT_ROOT}${normalized}`;
  }
  return `${DEFAULT_ROOT}/${normalized}`;
}

async function statEntry(path: string) {
  return getPromises().stat(toVirtualPath(path));
}

export function createWebStorageAdapter(): StorageAdapter {
  return {
    kind: 'web',
    defaultStoragePath: DEFAULT_ROOT,

    async selectStoragePath() {
      try {
        await getPromises().mkdir(DEFAULT_ROOT);
      } catch {
        // already exists
      }
      return DEFAULT_ROOT;
    },

    async readDir(path) {
      const dirPath = toVirtualPath(path);
      let names: string[];
      try {
        names = await getPromises().readdir(dirPath);
      } catch {
        return [];
      }

      const entries: DirEntry[] = [];
      for (const name of names) {
        if (!name || name === '.' || name === '..') continue;
        const childPath = `${dirPath}/${name}`.replace(/\/+/g, '/');
        try {
          const stat = await getPromises().stat(childPath);
          entries.push({
            name,
            isDirectory: stat.isDirectory(),
            isFile: stat.isFile(),
          });
        } catch {
          // skip broken entries
        }
      }
      return entries;
    },

    async readTextFile(path) {
      const content = await getPromises().readFile(toVirtualPath(path), { encoding: 'utf8' });
      return typeof content === 'string' ? content : new TextDecoder().decode(content as Uint8Array);
    },

    async writeTextFile(path, content) {
      const filePath = toVirtualPath(path);
      const parent = filePath.slice(0, filePath.lastIndexOf('/'));
      if (parent) {
        try {
          await getPromises().mkdir(parent);
        } catch {
          // parent may exist
        }
      }
      await getPromises().writeFile(filePath, content);
    },

    async mkdir(path, recursive = false) {
      const dirPath = toVirtualPath(path);
      if (recursive) {
        const parts = dirPath.split('/').filter(Boolean);
        let current = '';
        for (const part of parts) {
          current = `${current}/${part}`;
          try {
            await getPromises().mkdir(current);
          } catch {
            // exists
          }
        }
        return;
      }
      await getPromises().mkdir(dirPath);
    },

    async remove(path, recursive = false) {
      const target = toVirtualPath(path);
      try {
        const stat = await getPromises().stat(target);
        if (stat.isDirectory()) {
          if (recursive) {
            await removeDirRecursive(target);
          } else {
            await getPromises().rmdir(target);
          }
        } else {
          await getPromises().unlink(target);
        }
      } catch {
        // already gone
      }
    },

    async rename(oldPath, newPath) {
      const from = toVirtualPath(oldPath);
      const to = toVirtualPath(newPath);
      const parent = to.slice(0, to.lastIndexOf('/'));
      if (parent) {
        try {
          await getPromises().mkdir(parent);
        } catch {
          // exists
        }
      }
      await getPromises().rename(from, to);
    },

    exists(path) {
      return statEntry(path)
        .then(() => true)
        .catch(() => false);
    },

    async stat(path) {
      const info = await statEntry(path);
      return {
        isFile: info.isFile(),
        isDirectory: info.isDirectory(),
      };
    },
  };
}

async function removeDirRecursive(dirPath: string): Promise<void> {
  const promises = getPromises();
  let names: string[];
  try {
    names = await promises.readdir(dirPath);
  } catch {
    return;
  }

  for (const name of names) {
    if (!name || name === '.' || name === '..') continue;
    const childPath = `${dirPath}/${name}`.replace(/\/+/g, '/');
    const stat = await promises.stat(childPath);
    if (stat.isDirectory()) {
      await removeDirRecursive(childPath);
    } else {
      await promises.unlink(childPath);
    }
  }
  await promises.rmdir(dirPath);
}

/** Expose LightningFS instance for isomorphic-git on web. */
export function getWebLightningFs(): LightningFS {
  return getLightningFs();
}

export function getWebDefaultStoragePath(): string {
  return DEFAULT_ROOT;
}
