import assert from 'node:assert/strict';
import test from 'node:test';
import { findMindTextLinkAtOffset, splitMindTextLinks } from './mindTextLinks.ts';

test('modifier click resolves Markdown labels and bare URLs at the caret', () => {
  const text = 'Open [users](https://example.com/admin/users) or https://example.org/path.';
  assert.equal(findMindTextLinkAtOffset(text, text.indexOf('users')), 'https://example.com/admin/users');
  assert.equal(findMindTextLinkAtOffset(text, text.indexOf('example.com')), 'https://example.com/admin/users');
  assert.equal(findMindTextLinkAtOffset(text, text.indexOf('example.org')), 'https://example.org/path');
  assert.equal(findMindTextLinkAtOffset(text, text.indexOf('Open')), null);
  assert.equal(findMindTextLinkAtOffset('javascript:alert(1)', 4), null);
});

test('display segments keep raw text while marking only links as clickable', () => {
  assert.deepEqual(splitMindTextLinks('See [users](https://example.com/users) and https://example.org.'), [
    { text: 'See ' },
    { text: '[users](https://example.com/users)', href: 'https://example.com/users' },
    { text: ' and ' },
    { text: 'https://example.org', href: 'https://example.org' },
    { text: '.' },
  ]);
});
