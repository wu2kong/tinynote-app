import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import git from 'isomorphic-git';

import { allocateConflictCopyPath } from './syncConflictName.ts';

const author = { name: 'TinyNote', email: 'tinynote@local' };

async function write(dir: string, relative: string, content: string) {
  const full = path.join(dir, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

test('isomorphic-git merge keeps remote text and can save a local conflict copy', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tinynote-conflict-'));
  try {
    await git.init({ fs, dir, defaultBranch: 'main' });
    await git.setConfig({ fs, dir, path: 'user.name', value: author.name });
    await git.setConfig({ fs, dir, path: 'user.email', value: author.email });
    await write(dir, 'note.md', 'base\n');
    await git.add({ fs, dir, filepath: 'note.md' });
    await git.commit({ fs, dir, message: 'base', author });

    await git.branch({ fs, dir, ref: 'theirs' });
    await write(dir, 'note.md', 'local\n');
    await git.add({ fs, dir, filepath: 'note.md' });
    await git.commit({ fs, dir, message: 'ours', author });

    await git.checkout({ fs, dir, ref: 'theirs' });
    await write(dir, 'note.md', 'remote\n');
    await git.add({ fs, dir, filepath: 'note.md' });
    await git.commit({ fs, dir, message: 'theirs', author });
    await git.checkout({ fs, dir, ref: 'main' });

    const copies: string[] = [];
    await git.merge({
      fs,
      dir,
      ours: 'main',
      theirs: 'theirs',
      author,
      abortOnConflict: false,
      mergeDriver: async ({ path: filepath, contents }) => {
        const ours = contents[1] ?? '';
        const theirs = contents[2] ?? ours;
        if (ours && ours !== theirs) {
          const copyPath = await allocateConflictCopyPath(
            filepath,
            '（冲突版本 2026-08-24）',
            (candidate) => fs.existsSync(path.join(dir, candidate)),
          );
          fs.writeFileSync(path.join(dir, copyPath), ours);
          copies.push(copyPath);
        }
        return { cleanMerge: true, mergedText: theirs };
      },
    });
    await git.checkout({ fs, dir, ref: 'main', force: true });

    assert.equal(fs.readFileSync(path.join(dir, 'note.md'), 'utf8'), 'remote\n');
    assert.deepEqual(copies, ['note（冲突版本 2026-08-24）.md']);
    assert.equal(fs.readFileSync(path.join(dir, copies[0]), 'utf8'), 'local\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
