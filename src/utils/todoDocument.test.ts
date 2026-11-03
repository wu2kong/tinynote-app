import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyTodoDocument, parseTodoDocument, serializeTodoDocument } from './todoDocument.ts';

test('standalone todo document saves tasks and groups', () => {
  const doc = createEmptyTodoDocument();
  assert.equal(parseTodoDocument('{"todos":[]}').todoView, 'list');
  doc.todoView = 'board';
  doc.todoGroups.push({ id: 'g1', name: 'Work', collapsed: false });
  doc.todos.push({ id: 't1', text: 'Plan release', done: false, groupId: 'g1', createdAt: '2026-11-03T00:00:00Z' });
  assert.deepEqual(parseTodoDocument(serializeTodoDocument(doc)), doc);
  assert.equal(parseTodoDocument('{"todoView":"unknown"}').todoView, 'list');
  assert.deepEqual(parseTodoDocument('not json'), createEmptyTodoDocument());
});
