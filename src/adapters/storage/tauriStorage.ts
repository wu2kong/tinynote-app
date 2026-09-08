import {
  readDir, readFile, readTextFile, writeFile, writeTextFile, mkdir, remove, rename, exists, stat as tauriStat,
} from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { normalizePath } from '@/utils/path';
import { persistScopedAccess, pickWorkspaceFolder } from '@/utils/scopedAccess';
import type { DirEntry, StorageAdapter } from './types';
import { IS_MAC_APP_STORE } from '@/constants/distribution';

export function createTauriStorageAdapter(): StorageAdapter {
  return {
    kind: 'tauri',
    defaultStoragePath: '',

    async selectStoragePath() {
      if (IS_MAC_APP_STORE) {
        try {
          const picked = await pickWorkspaceFolder();
          return picked ? normalizePath(picked) : null;
        } catch (error) {
          console.warn('[tinynote] Native folder picker failed, falling back:', error);
        }
      }
      const selected = await open({
        directory: true,
        multiple: false,
        recursive: true,
      });
      if (!selected) return null;
      const path = normalizePath(selected as string);
      await persistScopedAccess(path);
      return path;
    },

    async readDir(path) {
      const entries = await readDir(normalizePath(path));
      return entries.map((entry): DirEntry => ({
        name: entry.name ?? '',
        isDirectory: entry.isDirectory,
        isFile: entry.isFile,
      }));
    },

    readTextFile(path) {
      return readTextFile(normalizePath(path));
    },

    writeTextFile(path, content) {
      return writeTextFile(normalizePath(path), content, { create: true });
    },

    readBinaryFile(path) {
      return readFile(normalizePath(path));
    },

    writeBinaryFile(path, content) {
      return writeFile(normalizePath(path), content, { create: true });
    },

    mkdir(path, recursive = false) {
      return mkdir(normalizePath(path), { recursive });
    },

    remove(path, recursive = false) {
      return remove(normalizePath(path), { recursive });
    },

    rename(oldPath, newPath) {
      return rename(normalizePath(oldPath), normalizePath(newPath));
    },

    exists(path) {
      return exists(normalizePath(path));
    },

    async stat(path) {
      const info = await tauriStat(normalizePath(path));
      return {
        isFile: info.isFile,
        isDirectory: info.isDirectory,
        size: info.size,
        mtimeMs: info.mtime ? info.mtime.getTime() : undefined,
      };
    },
  };
}
