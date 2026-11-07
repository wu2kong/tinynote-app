import type { ChannelDocument, ChannelLinkItem } from './channelDocument.ts';

export type BookmarkGroupKind = 'category' | 'tag';
export type BookmarkFilter = { kind: 'all' } | { kind: 'uncategorized' } | { kind: BookmarkGroupKind; id: string };

export function getBookmarkPreferences(doc: ChannelDocument) {
  return {
    view: doc.linkView ?? 'list',
    navigationCollapsed: doc.linkNavigationCollapsed ?? true,
    navigationMode: doc.linkNavigationMode ?? 'category',
  } as const;
}

export function filterBookmarks(doc: ChannelDocument, filter: BookmarkFilter): ChannelLinkItem[] {
  switch (filter.kind) {
    case 'all': return doc.links;
    case 'uncategorized': return doc.links.filter((link) => !doc.linkCategories?.some((group) => group.id === link.categoryId));
    case 'category': return doc.links.filter((link) => link.categoryId === filter.id);
    case 'tag': return doc.links.filter((link) => link.tagIds?.includes(filter.id));
  }
}

/** A category replaces the previous one; adding a tag preserves existing tags. */
export function assignBookmark(doc: ChannelDocument, linkId: string, kind: BookmarkGroupKind, groupId: string | null): ChannelDocument {
  const groups = kind === 'category' ? doc.linkCategories : doc.linkTags;
  if (groupId !== null && !groups?.some((group) => group.id === groupId)) return doc;
  if (kind === 'tag' && groupId === null) return doc;
  return {
    ...doc,
    links: doc.links.map((link) => {
      if (link.id !== linkId) return link;
      if (kind === 'category') {
        const { categoryId: _previous, ...rest } = link;
        return groupId ? { ...rest, categoryId: groupId } : rest;
      }
      return { ...link, tagIds: [...new Set([...(link.tagIds ?? []), groupId!])] };
    }),
  };
}

export function removeBookmarkGroup(doc: ChannelDocument, kind: BookmarkGroupKind, groupId: string): ChannelDocument {
  const key = kind === 'category' ? 'linkCategories' : 'linkTags';
  return {
    ...doc,
    [key]: (doc[key] ?? []).filter((group) => group.id !== groupId),
    links: doc.links.map((link) => {
      if (kind === 'tag') return { ...link, tagIds: link.tagIds?.filter((id) => id !== groupId) };
      if (link.categoryId !== groupId) return link;
      const { categoryId: _previous, ...rest } = link;
      return rest;
    }),
  };
}

/** Reorder only the visible slots so filtered-out bookmarks keep their positions. */
export function reorderBookmarks(links: ChannelLinkItem[], visibleIds: string[], activeId: string, overId: string): ChannelLinkItem[] {
  const visibleSet = new Set(visibleIds);
  const visible = links.filter((link) => visibleSet.has(link.id));
  const from = visible.findIndex((link) => link.id === activeId);
  const to = visible.findIndex((link) => link.id === overId);
  if (from < 0 || to < 0 || from === to) return links;
  visible.splice(to, 0, visible.splice(from, 1)[0]);
  let index = 0;
  return links.map((link) => visibleSet.has(link.id) ? visible[index++] : link);
}
