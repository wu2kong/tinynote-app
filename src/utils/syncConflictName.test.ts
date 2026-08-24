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
