import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectNotebookFormat,
  getMatchedNotebookSuffix,
  getNotebookDisplayName,
  getUnknownNotebookFormatSuffix,
  hasExplicitNotebookFormatMarker,
  resolveImportedNotebookFileName,
  resolveNotebookFileName,
} from './notebookFormat.ts';

test('detectNotebookFormat matches known suffixes first', () => {
  assert.equal(detectNotebookFormat('a.writer.md'), 'writer');
  assert.equal(detectNotebookFormat('a.mk.md'), 'markdown');
  assert.equal(detectNotebookFormat('a.blk.md'), 'blocks');
  assert.equal(detectNotebookFormat('a.md'), 'blocks');
  assert.equal(detectNotebookFormat('A.WRITER.MD'), 'writer');
});

test('unknown compound .token.md suffixes are unsupported', () => {
  assert.equal(detectNotebookFormat('map.treemind.md'), 'unsupported');
  assert.equal(detectNotebookFormat('todo.checklist.md'), 'unsupported');
  assert.equal(getUnknownNotebookFormatSuffix('map.treemind.md'), '.treemind.md');
  assert.equal(getUnknownNotebookFormatSuffix('Guide.mk.md'), null);
  assert.equal(getUnknownNotebookFormatSuffix('Legacy.md'), null);
  assert.equal(getNotebookDisplayName('map.treemind.md'), 'map');
  assert.equal(getMatchedNotebookSuffix('map.treemind.md'), '.treemind.md');
});

test('rename keeps an unknown future format suffix', () => {
  const resolved = resolveNotebookFileName('Renamed', 'unsupported', {
    preserveExtension: '.treemind.md',
  });
  assert.equal(resolved.fileName, 'Renamed.treemind.md');
  assert.equal(resolved.format, 'unsupported');
  assert.equal(resolved.displayName, 'Renamed');
});

test('import keeps unknown compound suffixes instead of converting to writer', () => {
  assert.equal(hasExplicitNotebookFormatMarker('map.treemind.md'), true);
  assert.deepEqual(resolveImportedNotebookFileName('map.treemind.md'), {
    fileName: 'map.treemind.md',
    converted: false,
  });
  assert.equal(resolveImportedNotebookFileName('plain.md').converted, true);
});
