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

test('message order survives serialization', () => {
  const doc = createEmptyChannelDocument('Me');
  const first = createChannelMessage('first', DEFAULT_SELF_MEMBER_ID);
  const second = createChannelMessage('second', DEFAULT_SELF_MEMBER_ID);
  doc.messages = [second, first];
  const parsed = parseChannelDocument(serializeChannelDocument(doc));
  assert.deepEqual(parsed.messages.map((message) => message.id), [second.id, first.id]);
});
