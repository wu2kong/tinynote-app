import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createChannelMessage,
  createEmptyChannelDocument,
  DEFAULT_SELF_MEMBER_ID,
  parseChannelDocument,
  serializeChannelDocument,
} from './channelDocument.ts';

test('parseChannelDocument round-trips JSON with members', () => {
  const doc = createEmptyChannelDocument('Alice', 'Ops');
  doc.subtitle = 'on-call';
  doc.messages.push(createChannelMessage('hello', DEFAULT_SELF_MEMBER_ID));
  const raw = serializeChannelDocument(doc);
  const parsed = parseChannelDocument(raw);
  assert.equal(parsed.title, 'Ops');
  assert.equal(parsed.subtitle, 'on-call');
  assert.equal(parsed.members.length, 1);
  assert.equal(parsed.members[0]?.name, 'Alice');
  assert.equal(parsed.messages.length, 1);
  assert.equal(parsed.messages[0]?.content, 'hello');
  assert.equal(parsed.messages[0]?.authorId, DEFAULT_SELF_MEMBER_ID);
});

test('parseChannelDocument migrates legacy messages without authorId', () => {
  const legacy = JSON.stringify({
    version: 1,
    messages: [{ id: 'm1', type: 'message', content: 'hi', sentAt: '2020-01-01T00:00:00.000Z' }],
    todos: [],
    links: [],
    resources: [],
  });
  const parsed = parseChannelDocument(legacy, 'Me');
  assert.equal(parsed.messages[0]?.authorId, DEFAULT_SELF_MEMBER_ID);
  assert.equal(parsed.members[0]?.isSelf, true);
  assert.equal(parsed.title, '');
  assert.equal(parsed.subtitle, '');
});

test('parseChannelDocument tolerates empty and invalid input', () => {
  assert.equal(parseChannelDocument('').members.length, 1);
  assert.deepEqual(parseChannelDocument('{not json').members.length, 1);
});

test('display options default for old documents and persist when disabled', () => {
  const legacy = parseChannelDocument('{"messages":[]}');
  assert.equal(legacy.showTime, true);
  assert.equal(legacy.showMemberAvatars, true);
  legacy.showTime = false;
  legacy.showMemberAvatars = false;
  const parsed = parseChannelDocument(serializeChannelDocument(legacy));
  assert.equal(parsed.showTime, false);
  assert.equal(parsed.showMemberAvatars, false);
});

test('todo view defaults to list and survives reopening', () => {
  const old = parseChannelDocument('{"todos":[]}');
  assert.equal(old.todoView, 'list');
  old.todoView = 'board';
  assert.equal(parseChannelDocument(serializeChannelDocument(old)).todoView, 'board');
  assert.equal(parseChannelDocument('{"todoView":"unknown"}').todoView, 'list');
});

test('channel section switches default on and always retain required sections', () => {
  assert.deepEqual(parseChannelDocument('{"messages":[]}').enabledTabs, ['chat', 'todos', 'links', 'resources', 'members', 'settings']);
  const parsed = parseChannelDocument('{"enabledTabs":["links","invalid"]}');
  assert.deepEqual(parsed.enabledTabs, ['chat', 'links', 'members', 'settings']);
  assert.deepEqual(parseChannelDocument(serializeChannelDocument(parsed)).enabledTabs, parsed.enabledTabs);
});

test('message order survives serialization', () => {
  const doc = createEmptyChannelDocument('Me');
  const first = createChannelMessage('first', DEFAULT_SELF_MEMBER_ID);
  const second = createChannelMessage('second', DEFAULT_SELF_MEMBER_ID);
  doc.messages = [second, first];
  const parsed = parseChannelDocument(serializeChannelDocument(doc));
  assert.deepEqual(parsed.messages.map((message) => message.id), [second.id, first.id]);
});

test('multiple message remarks and message-derived todos survive saving and reopening', () => {
  const doc = createEmptyChannelDocument('Me');
  const message = createChannelMessage('Follow up\non the release', DEFAULT_SELF_MEMBER_ID);
  message.remarks = [
    { id: 'r1', text: 'First remark\nwith details', createdAt: '2026-11-02T01:00:00.000Z' },
    { id: 'r2', text: 'Second remark', createdAt: '2026-11-02T02:00:00.000Z' },
  ];
  doc.messages.push(message);
  doc.todos.push({ id: 't1', text: message.content, done: false, createdAt: message.sentAt });
  const parsed = parseChannelDocument(serializeChannelDocument(doc));
  assert.deepEqual(parsed.messages[0].remarks, message.remarks);
  assert.deepEqual(parsed.todos, doc.todos);
});

test('legacy messages and malformed remarks remain readable', () => {
  const parsed = parseChannelDocument(JSON.stringify({ messages: [
    { content: 'Legacy' },
    { content: 'Invalid collection', remarks: 'bad' },
    { content: 'Mixed remarks', remarks: [null, 1, {}, { text: '  ' }, { text: 'Valid' }] },
  ] }));
  assert.equal(parsed.messages[0].remarks, undefined);
  assert.equal(parsed.messages[1].remarks, undefined);
  assert.equal(parsed.messages[2].remarks?.length, 1);
  assert.equal(parsed.messages[2].remarks?.[0].text, 'Valid');
  assert.ok(parsed.messages[2].remarks?.[0].id);
});
