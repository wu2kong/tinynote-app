import assert from 'node:assert/strict';
import test from 'node:test';

import {
  allocateConflictCopyPath,
  formatLocalIsoDate,
  splitRepoRelativePath,
  withConflictCopyCount,
} from './syncConflictName.ts';

test('formatLocalIsoDate uses local calendar date', () => {
  assert.equal(formatLocalIsoDate(new Date(2026, 7, 24)), '2026-08-24');
});

test('withConflictCopyCount inserts the number before the closing parenthesis', () => {
  assert.equal(withConflictCopyCount('（冲突版本 2026-08-24）', 1), '（冲突版本 2026-08-24）');
  assert.equal(withConflictCopyCount('（冲突版本 2026-08-24）', 2), '（冲突版本 2026-08-24 2）');
  assert.equal(withConflictCopyCount(' (conflict version 2026-08-24)', 3), ' (conflict version 2026-08-24 3)');
});

test('splitRepoRelativePath keeps the directory and extension', () => {
  assert.deepEqual(splitRepoRelativePath('space/note.md'), {
    dir: 'space/',
    stem: 'note',
    ext: '.md',
  });
});

test('splitRepoRelativePath inserts the conflict marker before notebook suffixes', () => {
  assert.deepEqual(
    splitRepoRelativePath(
      'TinyNote产品管理.tinynotes/公众号管理/公众号注册和定位.writer.md',
    ),
    {
      dir: 'TinyNote产品管理.tinynotes/公众号管理/',
      stem: '公众号注册和定位',
      ext: '.writer.md',
    },
  );
  assert.deepEqual(splitRepoRelativePath('group/guide.mk.md'), {
    dir: 'group/',
    stem: 'guide',
    ext: '.mk.md',
  });
  assert.deepEqual(splitRepoRelativePath('group/shell.blk.md'), {
    dir: 'group/',
    stem: 'shell',
    ext: '.blk.md',
  });
});

test('allocateConflictCopyPath skips names that already exist', async () => {
  const existing = new Set([
    'space/note（冲突版本 2026-08-24）.md',
  ]);
  const path = await allocateConflictCopyPath(
    'space/note.md',
    '（冲突版本 2026-08-24）',
    (candidate) => existing.has(candidate),
  );
  assert.equal(path, 'space/note（冲突版本 2026-08-24 2）.md');
});

test('allocateConflictCopyPath keeps the folder and writer suffix', async () => {
  const path = await allocateConflictCopyPath(
    'TinyNote产品管理.tinynotes/公众号管理/公众号注册和定位.writer.md',
    '（冲突版本 2026-08-28）',
    () => false,
  );
  assert.equal(
    path,
    'TinyNote产品管理.tinynotes/公众号管理/公众号注册和定位（冲突版本 2026-08-28）.writer.md',
  );
});
