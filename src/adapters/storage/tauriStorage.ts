import { readDir, readTextFile, writeTextFile, mkdir, remove, rename, exists, stat as tauriStat } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { normalizePath } from '@/utils/path';
import type { DirEntry, StorageAdapter } from './types';

export function createTauriStorageAdapter(): StorageAdapter {
  return {
    kind: 'tauri',
    defaultStoragePath: '',

    async selectStoragePath() {
      const selected = await open({
        directory: true,
        multiple: false,
        recursive: true,
      });
      return selected ? normalizePath(selected as string) : null;
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
      };
    },
  };
}
