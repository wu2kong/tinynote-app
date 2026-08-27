import assert from 'node:assert/strict';
import test from 'node:test';
import git from 'isomorphic-git';

import { createGitFsFromStorage } from './gitFs.ts';
import type { DirEntry, FileStat, StorageAdapter } from '../storage/types.ts';

function createMemoryStorage(): StorageAdapter {
  type Entry = { kind: 'dir' } | { kind: 'file'; data: Uint8Array };
  const entries = new Map<string, Entry>();
  entries.set('/', { kind: 'dir' });

  const normalize = (path: string) => path.replace(/\\/g, '/').replace(/\/+/g, '/') || '/';

  const parentOf = (path: string) => {
    const normalized = normalize(path);
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? '/' : normalized.slice(0, index);
  };

  return {
    kind: 'web',
    defaultStoragePath: '/library',
    async selectStoragePath() {
      return '/library';
    },
    async readDir(path) {
      const dir = normalize(path);
      if (!entries.has(dir) || entries.get(dir)?.kind !== 'dir') {
        throw new Error('ENOENT');
      }
      const prefix = dir === '/' ? '/' : `${dir}/`;
      const names = new Set<string>();
      const result: DirEntry[] = [];
      for (const key of entries.keys()) {
        if (key === dir || !key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const name = rest.split('/')[0];
        if (!name || names.has(name)) continue;
        names.add(name);
        const child = entries.get(normalize(`${prefix}${name}`));
        result.push({
          name,
          isDirectory: child?.kind === 'dir',
          isFile: child?.kind === 'file',
        });
      }
      return result;
    },
    async readTextFile(path) {
      const entry = entries.get(normalize(path));
      if (!entry || entry.kind !== 'file') throw new Error('ENOENT');
      return new TextDecoder().decode(entry.data);
    },
    async writeTextFile(path, content) {
      await this.writeBinaryFile(path, new TextEncoder().encode(content));
    },
    async readBinaryFile(path) {
      const entry = entries.get(normalize(path));
      if (!entry || entry.kind !== 'file') throw new Error('ENOENT');
      return entry.data;
    },
    async writeBinaryFile(path, content) {
      const resolved = normalize(path);
      entries.set(parentOf(resolved), { kind: 'dir' });
      entries.set(resolved, { kind: 'file', data: new Uint8Array(content) });
    },
    async mkdir(path, recursive = false) {
      const resolved = normalize(path);
      if (recursive) {
        const parts = resolved.split('/').filter(Boolean);
        let current = '';
        for (const part of parts) {
          current += `/${part}`;
          entries.set(current, { kind: 'dir' });
        }
        return;
      }
      entries.set(resolved, { kind: 'dir' });
    },
    async remove(path) {
      const resolved = normalize(path);
      for (const key of [...entries.keys()]) {
        if (key === resolved || key.startsWith(`${resolved}/`)) {
          entries.delete(key);
        }
      }
    },
    async rename(oldPath, newPath) {
      const from = normalize(oldPath);
      const to = normalize(newPath);
      const entry = entries.get(from);
      if (!entry) throw new Error('ENOENT');
      entries.set(to, entry);
      entries.delete(from);
    },
    async exists(path) {
      return entries.has(normalize(path));
    },
    async stat(path): Promise<FileStat> {
      const entry = entries.get(normalize(path));
      if (!entry) throw new Error('ENOENT');
      return {
        isFile: entry.kind === 'file',
        isDirectory: entry.kind === 'dir',
        size: entry.kind === 'file' ? entry.data.byteLength : 0,
        mtimeMs: Date.now(),
      };
    },
  };
}

test('gitFs reports ENOENT with a node-like error code', async () => {
  const storage = createMemoryStorage();
  const fs = createGitFsFromStorage(storage, '/library').promises;
  await assert.rejects(
    () => fs.stat('/library/missing.txt'),
    (error: unknown) => error instanceof Error && (error as { code?: string }).code === 'ENOENT',
  );
});

test('Buffer polyfill restores isomorphic-git when global Buffer is missing', async () => {
  const original = globalThis.Buffer;
  try {
    const deleted = delete (globalThis as { Buffer?: typeof Buffer }).Buffer;
    assert.equal(deleted, true);
    assert.equal(typeof (globalThis as { Buffer?: unknown }).Buffer, 'undefined');

    await import('../../polyfills/nodeBuffer.ts');
    assert.equal(typeof globalThis.Buffer.from, 'function');

    const storage = createMemoryStorage();
    await storage.mkdir('/library', true);
    const fs = createGitFsFromStorage(storage, '/library').promises;
    await git.init({ fs, dir: '/library', defaultBranch: 'main' });
    assert.equal(await git.currentBranch({ fs, dir: '/library' }), 'main');
  } finally {
    globalThis.Buffer = original;
  }
});

test('isomorphic-git can init, commit, and read a blob through gitFs', async () => {
  const storage = createMemoryStorage();
  await storage.mkdir('/library', true);
  const fs = createGitFsFromStorage(storage, '/library').promises;
  const dir = '/library';
  const author = { name: 'TinyNote', email: 'tinynote@local' };

  await git.init({ fs, dir, defaultBranch: 'main' });
  await git.setConfig({ fs, dir, path: 'user.name', value: author.name });
  await git.setConfig({ fs, dir, path: 'user.email', value: author.email });
  await storage.writeTextFile('/library/note.md', 'hello from tinynote\n');
  await git.add({ fs, dir, filepath: 'note.md' });
  const oid = await git.commit({ fs, dir, message: 'init', author });
  const { blob } = await git.readBlob({ fs, dir, oid, filepath: 'note.md' });
  assert.equal(new TextDecoder().decode(blob), 'hello from tinynote\n');
});
