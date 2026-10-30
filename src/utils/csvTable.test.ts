import assert from 'node:assert/strict';
import test from 'node:test';

import { escapeCsvField, moveCsvColumn, moveCsvRow, parseCsv, serializeCsv } from './csvTable.ts';

test('parseCsv and serializeCsv round-trip', () => {
  const raw = 'a,b,c\n"hello, world",x,y\n';
  assert.deepEqual(parseCsv(raw), [
    ['a', 'b', 'c'],
    ['hello, world', 'x', 'y'],
  ]);
  assert.equal(serializeCsv(parseCsv(raw)), raw);
});

test('serializeCsv wraps line breaks in double quotes', () => {
  assert.equal(escapeCsvField('plain'), 'plain');
  assert.equal(escapeCsvField('a,b'), '"a,b"');
  assert.equal(escapeCsvField('line1\nline2'), '"line1\nline2"');
  assert.equal(serializeCsv([['name', 'line1\nline2', 'ok']]), 'name,"line1\nline2",ok\n');
});

test('parseCsv reads quoted multiline fields', () => {
  const raw = 'a,"line1\nline2",c\n';
  assert.deepEqual(parseCsv(raw), [['a', 'line1\nline2', 'c']]);
  assert.equal(serializeCsv(parseCsv(raw)), raw);
});

test('parseCsv handles escaped quotes', () => {
  assert.deepEqual(parseCsv('"say ""hi""",ok\n'), [['say "hi"', 'ok']]);
});

test('parseCsv yields at least one empty cell for empty input', () => {
  assert.deepEqual(parseCsv(''), [['']]);
});

test('moveCsvRow and moveCsvColumn reorder grid data', () => {
  const grid = [['a', 'b'], ['c', 'd'], ['e', 'f']];
  assert.deepEqual(moveCsvRow(grid, 0, 2), [['c', 'd'], ['e', 'f'], ['a', 'b']]);
  assert.deepEqual(moveCsvColumn(grid, 1, 0), [['b', 'a'], ['d', 'c'], ['f', 'e']]);
});
