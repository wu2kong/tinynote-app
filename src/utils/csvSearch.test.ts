import assert from 'node:assert/strict';
import test from 'node:test';
import { findCsvCells } from './csvSearch.ts';
import { getCsvRowSegments } from './csvViewport.ts';

test('search matches Chinese, case-insensitive text and literal special characters in row order', () => {
  const grid = [['来源', 'Steam STEAM'], ['信息来源', 'steam'], ['a.b', 'axb']];
  assert.deepEqual(findCsvCells(grid, ' 来源 '), [{ rowIndex: 0, colIndex: 0 }, { rowIndex: 1, colIndex: 0 }]);
  assert.deepEqual(findCsvCells(grid, 'STEAM'), [{ rowIndex: 0, colIndex: 1 }, { rowIndex: 1, colIndex: 1 }]);
  assert.deepEqual(findCsvCells(grid, 'a.b'), [{ rowIndex: 2, colIndex: 0 }]);
});

test('empty queries and missing text return no matches; edits are reflected', () => {
  assert.deepEqual(findCsvCells([['value']], '  '), []);
  assert.deepEqual(findCsvCells([['value']], 'missing'), []);
  assert.deepEqual(findCsvCells([['changed']], 'value'), []);
  assert.deepEqual(findCsvCells([['line one\nline two']], 'one\nline'), [{ rowIndex: 0, colIndex: 0 }]);
});

test('search finds off-screen cells and mounts a target without losing the focused editor', () => {
  const grid = Array.from({ length: 1000 }, (_, index) => [`row ${index}`]);
  const [match] = findCsvCells(grid, 'row 999');
  assert.deepEqual(match, { rowIndex: 999, colIndex: 0 });
  const segments = getCsvRowSegments(grid.length, 0, 600, 40, 500, 8, [match.rowIndex]);
  const visible = segments.filter(s => s.kind === 'rows');
  for (const row of [0, 500, 999]) assert.ok(visible.some(s => s.start <= row && row < s.end));
  assert.ok(visible.reduce((sum, s) => sum + s.end - s.start, 0) < 30);
  assert.equal(segments.reduce((sum, s) => sum + (s.end - s.start) * 40, 0), 40000);
});
