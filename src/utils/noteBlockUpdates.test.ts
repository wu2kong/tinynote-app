import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeNoteBlockUpdate } from './noteBlockUpdates.ts';

const block = (id: string, content: string, createdAt = id) => ({
  id, content, createdAt, title: id, contentType: 'text' as const, tags: [], updatedAt: createdAt,
});

test('updates only the requested fields and preserves newer sibling edits', () => {
  const known = [block('a', 'old'), block('b', 'old')];
  const saved = [block('parsed-a', 'latest', 'a'), block('parsed-b', 'other window edit', 'b')];
  const result = mergeNoteBlockUpdate(saved, known, 'a', { title: 'new title' });
  assert.equal(result?.[0].title, 'new title');
  assert.equal(result?.[0].content, 'latest');
  assert.equal(result?.[1].content, 'other window edit');
  assert.equal(result?.[1].id, 'b');
});

test('follows a reordered block and does not recreate a deleted block', () => {
  const known = [block('a', 'a'), block('b', 'b')];
  const result = mergeNoteBlockUpdate([known[1], known[0]], known, 'a', { content: 'changed' });
  assert.equal(result?.[1].content, 'changed');
  assert.equal(mergeNoteBlockUpdate([known[1]], known, 'a', { content: 'changed' }), null);
});
