import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyChannelDocument, parseChannelDocument, serializeChannelDocument, serializeLinkDocument } from './channelDocument.ts';
import { assignBookmark, filterBookmarks, getBookmarkPreferences, removeBookmarkGroup, reorderBookmarks } from './bookmarkOrganization.ts';

function fixture() {
  return {
    ...createEmptyChannelDocument('Me'),
    linkCategories: [{ id: 'work', name: 'Work' }, { id: 'read', name: 'Reading' }],
    linkTags: [{ id: 'daily', name: 'Daily' }, { id: 'reference', name: 'Reference' }],
    links: [
      { id: 'a', title: 'Alpha', url: 'https://a.test', note: '', createdAt: '2026-11-04', categoryId: 'work', tagIds: ['daily'] },
      { id: 'b', title: 'Beta', url: 'https://b.test', note: '', createdAt: '2026-11-04', categoryId: 'read', tagIds: [] },
      { id: 'c', title: 'Gamma', url: 'https://c.test', note: '', createdAt: '2026-11-04', categoryId: 'work', tagIds: ['reference'] },
      { id: 'd', title: 'Delta', url: 'https://d.test', note: '', createdAt: '2026-11-04' },
    ],
  };
}

test('moving to a category replaces the old category and preserves all tags', () => {
  const original = fixture();
  const moved = assignBookmark(original, 'a', 'category', 'read');
  assert.equal(moved.links[0].categoryId, 'read');
  assert.deepEqual(moved.links[0].tagIds, ['daily']);
  assert.equal(original.links[0].categoryId, 'work');
  assert.deepEqual(filterBookmarks(moved, { kind: 'category', id: 'work' }).map((link) => link.id), ['c']);
  assert.deepEqual(filterBookmarks(moved, { kind: 'category', id: 'read' }).map((link) => link.id), ['a', 'b']);
});

test('dropping onto tags adds multiple tags without duplicating them or changing category', () => {
  let doc = assignBookmark(fixture(), 'a', 'tag', 'reference');
  doc = assignBookmark(doc, 'a', 'tag', 'reference');
  assert.deepEqual(doc.links[0].tagIds, ['daily', 'reference']);
  assert.equal(doc.links[0].categoryId, 'work');
  assert.deepEqual(filterBookmarks(doc, { kind: 'tag', id: 'reference' }).map((link) => link.id), ['a', 'c']);
  assert.equal(assignBookmark(doc, 'a', 'tag', 'missing'), doc);
  assert.equal(assignBookmark(doc, 'a', 'category', 'missing'), doc);
  assert.equal(assignBookmark(doc, 'a', 'tag', null), doc);
});

test('uncategorized drop clears only the category', () => {
  const doc = assignBookmark(fixture(), 'a', 'category', null);
  assert.equal(doc.links[0].categoryId, undefined);
  assert.deepEqual(doc.links[0].tagIds, ['daily']);
  assert.deepEqual(filterBookmarks(doc, { kind: 'uncategorized' }).map((link) => link.id), ['a', 'd']);
  assert.equal(filterBookmarks(doc, { kind: 'all' }).length, 4);
});

test('deleting categories and tags retains bookmarks and cleans their assignments', () => {
  let doc = removeBookmarkGroup(fixture(), 'category', 'work');
  assert.equal(doc.links.length, 4);
  assert.deepEqual(doc.linkCategories?.map((group) => group.id), ['read']);
  assert.deepEqual(filterBookmarks(doc, { kind: 'uncategorized' }).map((link) => link.id), ['a', 'c', 'd']);
  assert.deepEqual(doc.links[0].tagIds, ['daily']);
  doc = removeBookmarkGroup(doc, 'tag', 'daily');
  assert.deepEqual(doc.links[0].tagIds, []);
  assert.deepEqual(doc.links[2].tagIds, ['reference']);
  assert.equal(doc.links[1].categoryId, 'read');
});

test('filtered bookmark sorting preserves hidden bookmarks and persists the new order', () => {
  const doc = fixture();
  const visible = filterBookmarks(doc, { kind: 'category', id: 'work' });
  doc.links = reorderBookmarks(doc.links, visible.map((link) => link.id), 'c', 'a');
  assert.deepEqual(doc.links.map((link) => link.id), ['c', 'b', 'a', 'd']);
  const reopened = parseChannelDocument(serializeLinkDocument(doc));
  assert.deepEqual(filterBookmarks(reopened, { kind: 'category', id: 'work' }).map((link) => link.id), ['c', 'a']);
  assert.equal(reorderBookmarks(doc.links, ['a', 'c'], 'a', 'b'), doc.links);
});

test('standalone and channel documents retain categories, tag order, assignments and navigation state', () => {
  const doc = { ...fixture(), linkNavigationCollapsed: true };
  doc.linkCategories.reverse();
  doc.linkTags.reverse();
  for (const serialize of [serializeLinkDocument, serializeChannelDocument]) {
    const reopened = parseChannelDocument(serialize(doc));
    assert.deepEqual(reopened.links, doc.links);
    assert.deepEqual(reopened.linkCategories, doc.linkCategories);
    assert.deepEqual(reopened.linkTags, doc.linkTags);
    assert.equal(reopened.linkNavigationCollapsed, true);
  }
  assert.equal('members' in JSON.parse(serializeLinkDocument(doc)), false);
});

test('legacy bookmarks remain uncategorized and malformed group metadata is normalized', () => {
  const doc = parseChannelDocument(JSON.stringify({ links: [{ id: 'old', url: 'https://old.test' }] }));
  assert.equal(filterBookmarks(doc, { kind: 'uncategorized' }).length, 1);
  const parsed = parseChannelDocument(JSON.stringify({
    linkCategories: [null, { id: 'a', name: '  Work  ' }, { id: 'a', name: 'Duplicate' }, { id: 'empty', name: ' ' }],
    linkTags: [{ id: 'b', name: 'Read' }],
    links: [{ url: 'https://test.test', categoryId: 123, tagIds: ['b', 'b', null, 5, ''] }],
  }));
  assert.deepEqual(parsed.linkCategories, [{ id: 'a', name: 'Work' }]);
  assert.deepEqual(parsed.links[0].tagIds, ['b']);
  assert.equal(parsed.links[0].categoryId, undefined);
});

test('new and legacy bookmarks default to a list with navigation hidden', () => {
  for (const raw of ['', '{"version":1,"links":[]}', '{"linkView":"unknown","linkNavigationCollapsed":"false","linkNavigationMode":"unknown"}']) {
    const doc = parseChannelDocument(raw);
    assert.deepEqual(getBookmarkPreferences(doc), { view: 'list', navigationCollapsed: true, navigationMode: 'category' });
  }
});

test('all bookmark views and navigation preferences survive saving and reopening', () => {
  for (const view of ['list', 'cards', 'table'] as const) {
    for (const navigationCollapsed of [true, false]) {
      for (const navigationMode of ['category', 'tag'] as const) {
        const doc = { ...fixture(), linkView: view, linkNavigationCollapsed: navigationCollapsed, linkNavigationMode: navigationMode };
        for (const serialize of [serializeLinkDocument, serializeChannelDocument]) {
          const reopened = parseChannelDocument(serialize(doc));
          assert.deepEqual(getBookmarkPreferences(reopened), { view, navigationCollapsed, navigationMode });
          assert.deepEqual(reopened.links, doc.links);
          // Editing content after reopening must keep the page configuration.
          reopened.links[0].title = 'Updated';
          assert.deepEqual(getBookmarkPreferences(parseChannelDocument(serialize(reopened))), { view, navigationCollapsed, navigationMode });
        }
      }
    }
  }
});
