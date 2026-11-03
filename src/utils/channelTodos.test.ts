import assert from 'node:assert/strict';
import test from 'node:test';
import { moveTodo, moveTodoGroup, removeTodoGroup, shouldShowTodoGroups, todoGroupId, restoreChecklistDeletion, insertTodoGroup } from './channelTodos.ts';
import { parseChannelDocument, serializeChannelDocument, type ChannelTodoItem } from './channelDocument.ts';

const todos: ChannelTodoItem[] = [
  { id: '1', text: 'First', done: false, createdAt: '2026-11-02', groupId: 'a' },
  { id: '2', text: 'Completed in place', done: true, createdAt: '2026-11-02', groupId: 'a' },
  { id: '3', text: 'Third', done: false, createdAt: '2026-11-02', groupId: 'a' },
  { id: '4', text: 'Other group', done: false, createdAt: '2026-11-02', groupId: 'b' },
];
const groups = [{ id: 'a', name: 'Work', collapsed: true }, { id: 'b', name: 'Home', collapsed: false }];

test('task ordering includes completed tasks and supports dragging in both directions', () => {
  assert.deepEqual(moveTodo(todos, '1', 'a', '3').map((task) => task.id), ['2', '3', '1', '4']);
  assert.deepEqual(moveTodo(todos, '3', 'a', '1').map((task) => task.id), ['3', '1', '2', '4']);
  assert.equal(moveTodo(todos, '2', 'a', '3')[2].done, true);
  assert.deepEqual(todos.map((task) => task.id), ['1', '2', '3', '4']);
});

test('dragging between groups inserts before the target and updates membership', () => {
  const next = moveTodo(todos, '2', 'b', '4');
  assert.deepEqual(next.map((task) => task.id), ['1', '3', '2', '4']);
  assert.equal(next[2].groupId, 'b');
  assert.equal(next[2].done, true);
});

test('group headers accept tasks in empty or collapsed groups and ungrouped list', () => {
  assert.equal(moveTodo(todos, '1', 'empty').at(-1)?.groupId, 'empty');
  assert.equal(moveTodo(todos, '1', '').at(-1)?.groupId, undefined);
  assert.equal(moveTodo(todos, '1', 'b').at(-1)?.groupId, 'b');
  assert.equal(moveTodo(todos, 'missing', 'b'), todos);
  assert.equal(moveTodo(todos, '1', 'a', '1'), todos);
  assert.equal(moveTodo(todos, '1', 'a', 'missing'), todos);
});

test('deleting a group removes its active and completed tasks only', () => {
  const next = removeTodoGroup(todos, 'a');
  assert.deepEqual(next.map((task) => task.id), ['4']);
  assert.deepEqual(next.map((task) => task.groupId), ['b']);
  assert.equal(todos.length, 4);
  assert.equal(todoGroupId(todos[0], []), '');
  assert.equal(todoGroupId(todos[0], groups), 'a');
});

test('group names, collapse state, membership and manual order persist', () => {
  const ordered = moveTodo(todos, '3', 'a', '1');
  const doc = parseChannelDocument(JSON.stringify({ todos: ordered, todoGroups: groups }));
  const saved = parseChannelDocument(serializeChannelDocument(doc));
  assert.deepEqual(saved.todos, ordered);
  assert.deepEqual(saved.todoGroups, groups);
});

test('old tasks remain ungrouped and existing metadata is preserved', () => {
  const task = { id: 'old', text: 'Existing', done: true, createdAt: '2026-11-02', notes: 'Keep this', priority: 'high', dueDate: '2026-11-03' };
  const doc = parseChannelDocument(JSON.stringify({ todos: [task] }));
  assert.equal(todoGroupId(doc.todos[0], doc.todoGroups ?? []), '');
  assert.deepEqual(parseChannelDocument(serializeChannelDocument(doc)).todos[0], task);
});

test('plain checklist appears only without groups or task group metadata', () => {
  assert.equal(shouldShowTodoGroups([], []), false);
  assert.equal(shouldShowTodoGroups([{ ...todos[0], groupId: undefined }], []), false);
  assert.equal(shouldShowTodoGroups([], groups), true);
  assert.equal(shouldShowTodoGroups(todos, []), true);
});

test('group dragging preserves membership and persists group order', () => {
  const ordered = moveTodoGroup(groups, 'a', 'b');
  assert.deepEqual(ordered.map((group) => group.id), ['b', 'a']);
  assert.deepEqual(moveTodoGroup(ordered, 'a', 'b'), groups);
  assert.equal(moveTodoGroup(groups, 'unknown', 'b'), groups);
  const saved = parseChannelDocument(serializeChannelDocument(parseChannelDocument(JSON.stringify({ todos, todoGroups: ordered }))));
  assert.deepEqual(saved.todoGroups, ordered);
  assert.deepEqual(saved.todos, todos);
});

test('undo group deletion restores its tasks, completion states and order without losing new work', () => {
  const deletion = { tasks: todos.flatMap((item, index) => item.groupId === 'a' ? [{ item, index }] : []), group: { item: groups[0], index: 0 } };
  const added = { ...todos[3], id: 'new', text: 'Added after deletion' };
  const restored = restoreChecklistDeletion([...removeTodoGroup(todos, 'a'), added], [groups[1]], deletion);
  assert.deepEqual(restored.todos, [...todos, added]);
  assert.deepEqual(restored.groups, groups);
  assert.deepEqual(restoreChecklistDeletion(restored.todos, restored.groups, deletion), restored);
});

test('undo task deletion restores its original position without reverting other edits', () => {
  const edited = { ...todos[0], text: 'Edited after deleting another task' };
  const restored = restoreChecklistDeletion([edited, todos[2], todos[3]], groups, { tasks: [{ item: todos[1], index: 1 }] });
  assert.deepEqual(restored.todos, [edited, ...todos.slice(1)]);
});


test('new empty task rows survive saving without discarding their position or group', () => {
  const blank = { id: 'blank', text: '', done: false, createdAt: '2026-11-02', groupId: 'a' };
  const items = [todos[0], blank, ...todos.slice(1)];
  const doc = parseChannelDocument(JSON.stringify({ todos: items, todoGroups: groups }));
  assert.deepEqual(parseChannelDocument(serializeChannelDocument(doc)).todos, items);
  assert.equal(parseChannelDocument(JSON.stringify({ todos: [{ text: '' }, { id: 'bad' }] })).todos.length, 0);
});


test('relative group insertion keeps existing order and survives serialization', () => {
  const group = { id: 'new-group', name: 'New group', collapsed: false };
  assert.deepEqual(insertTodoGroup(groups, group, 'b', 'before').map((item) => item.id), ['a', 'new-group', 'b']);
  const after = insertTodoGroup(groups, group, 'b', 'after');
  assert.deepEqual(after.map((item) => item.id), ['a', 'b', 'new-group']);
  assert.deepEqual(insertTodoGroup(groups, group, 'a', 'before').map((item) => item.id), ['new-group', 'a', 'b']);
  assert.deepEqual(insertTodoGroup(groups, group, 'missing'), after);
  assert.deepEqual(parseChannelDocument(serializeChannelDocument(parseChannelDocument(JSON.stringify({ todoGroups: after })))).todoGroups, after);
});
