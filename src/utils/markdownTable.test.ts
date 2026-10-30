import assert from 'node:assert/strict';
import test from 'node:test';

import { gridToMarkdownTable, parseMarkdownTable } from './markdownTable.ts';

test('gridToMarkdownTable and parseMarkdownTable round-trip', () => {
  const grid = [['Name', 'Value'], ['a', '1'], ['b', '2']];
  const md = gridToMarkdownTable(grid);
  assert.deepEqual(parseMarkdownTable(md), grid);
});

test('parseMarkdownTable supports multiline cells via br tags', () => {
  const md = '| Title | Body |\n| --- | --- |\n| note | line1<br>line2 |\n';
  assert.deepEqual(parseMarkdownTable(md), [['Title', 'Body'], ['note', 'line1\nline2']]);
});

test('parseMarkdownTable rejects invalid input', () => {
  assert.throws(() => parseMarkdownTable('not a table'), /Markdown table/);
});
