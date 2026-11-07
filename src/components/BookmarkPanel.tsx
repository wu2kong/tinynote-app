import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin,
  useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Copy, Folder, GripVertical, Layers, Link2, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { createChannelId, type BookmarkView, type ChannelDocument, type ChannelLinkGroup, type ChannelLinkItem } from '@/utils/channelDocument';
import { assignBookmark, filterBookmarks, getBookmarkPreferences, removeBookmarkGroup, reorderBookmarks, type BookmarkFilter, type BookmarkGroupKind } from '@/utils/bookmarkOrganization';
import { parseChannelLinks } from '@/utils/parseChannelLinks';
import { isExternalHref, openExternalLink } from '@/utils/openExternalLink';
import ContextMenuPortal from './ContextMenuPortal';
import { showToast } from './Toast';

interface BookmarkPanelProps {
  doc: ChannelDocument;
  onChange: (doc: ChannelDocument) => void;
}

const navId = (kind: BookmarkGroupKind, id: string) => `bookmark-${kind}:${id}`;
const linkId = (id: string) => `bookmark-link:${id}`;

// Navigation accepts bookmark drops, but its own rows only sort within their section.
const bookmarkCollision: CollisionDetection = (args) => {
  const kind = args.active.data.current?.kind;
  const droppableContainers = args.droppableContainers.filter((container) => (
    kind === 'link' || container.data.current?.kind === kind
  ));
  const scoped = { ...args, droppableContainers };
  return args.pointerCoordinates ? pointerWithin(scoped) : closestCenter(scoped);
};

function NavigationRow({ group, kind, selected, count, onSelect, onMenu, dragLabel, menuLabel }: {
  group: ChannelLinkGroup; kind: BookmarkGroupKind; selected: boolean; count: number;
  onSelect: () => void; onMenu: (x: number, y: number) => void; dragLabel: string; menuLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver, active } = useSortable({
    id: navId(kind, group.id), data: { kind, groupId: group.id, name: group.name },
  });
  const accepting = isOver && active?.data.current?.kind === 'link';
  return (
    <div ref={setNodeRef} className={`bookmark-nav-row${selected ? ' selected' : ''}${accepting ? ' drop-target' : ''}`}
      style={{ transform: !isDragging && transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition, opacity: isDragging ? 0.35 : 1 }}
      onContextMenu={(event) => { event.preventDefault(); onMenu(event.clientX, event.clientY); }}>
      <button type="button" className="bookmark-nav-grip" {...attributes} {...listeners} aria-label={dragLabel} title={dragLabel}><GripVertical size={13} /></button>
      <button type="button" className="bookmark-nav-select" onClick={onSelect} aria-current={selected ? 'page' : undefined} title={group.name}>
        {kind === 'category' ? <Folder size={15} /> : <Tag size={15} />}
        <span>{group.name}</span><small>{count}</small>
      </button>
      <button type="button" className="bookmark-nav-menu" aria-label={menuLabel} title={menuLabel} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onMenu(rect.left, rect.bottom); }}><MoreHorizontal size={14} /></button>
    </div>
  );
}

function UncategorizedRow({ selected, count, label, onSelect }: { selected: boolean; count: number; label: string; onSelect: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'bookmark-uncategorized', data: { kind: 'uncategorized' } });
  return <button ref={setNodeRef} type="button" className={`bookmark-nav-fixed${selected ? ' selected' : ''}${isOver ? ' drop-target' : ''}`} onClick={onSelect} aria-current={selected ? 'page' : undefined}>
    <Folder size={15} /><span>{label}</span><small>{count}</small>
  </button>;
}

function BookmarkRow({ item, view, dragLabel, onMenu, children }: { item: ChannelLinkItem; view: BookmarkView; dragLabel: string; onMenu: (x: number, y: number) => void; children: React.ReactNode }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: linkId(item.id), data: { kind: 'link', linkId: item.id, name: item.title || item.url },
  });
  const Row = view === 'table' ? 'tr' : 'li';
  const handle = <button type="button" className="channel-link-drag" {...attributes} {...listeners} aria-label={dragLabel} title={dragLabel}><GripVertical size={15} /></button>;
  return <Row ref={setNodeRef} className={`channel-sortable-link bookmark-row bookmark-row-${view}`}
    style={{ transform: !isDragging && transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition, opacity: isDragging ? 0.35 : 1 }}
    onContextMenu={(event) => { event.preventDefault(); onMenu(event.clientX, event.clientY); }}>
    {view === 'table' ? <td className="bookmark-table-drag">{handle}</td> : handle}
    {children}
  </Row>;
}

const emptyDraft = { url: '', title: '', note: '' };

const BookmarkPanel: React.FC<BookmarkPanelProps> = ({ doc, onChange }) => {
  const { t } = useI18n();
  const docRef = useRef(doc);
  docRef.current = doc;
  const [filter, setFilter] = useState<BookmarkFilter>({ kind: 'all' });
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState<ChannelLinkItem | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [groupEditor, setGroupEditor] = useState<{ kind: BookmarkGroupKind; id?: string; name: string } | null>(null);
  const [menu, setMenu] = useState<{ kind: 'link' | BookmarkGroupKind; id: string; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<{ kind: string; name: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const categories = doc.linkCategories ?? [];
  const tags = doc.linkTags ?? [];
  const { view, navigationCollapsed: collapsed, navigationMode } = getBookmarkPreferences(doc);
  const navigationGroups = navigationMode === 'category' ? categories : tags;
  const validFilter: BookmarkFilter = (filter.kind === 'category' && !categories.some((group) => group.id === filter.id))
    || (filter.kind === 'tag' && !tags.some((group) => group.id === filter.id)) ? { kind: 'all' } : filter;
  const visible = filterBookmarks(doc, validFilter);
  const selectedName = validFilter.kind === 'all' ? t('bookmarks.all')
    : validFilter.kind === 'uncategorized' ? t('bookmarks.uncategorized')
      : (validFilter.kind === 'category' ? categories : tags).find((group) => group.id === validFilter.id)?.name ?? '';

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      // Let dnd-kit cancel an active keyboard drag without closing other UI.
      if (dragging) return;
      setEditing(null); setBulkOpen(false); setGroupEditor(null); setMenu(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dragging]);

  const withCurrentGroup = (item: ChannelLinkItem): ChannelLinkItem => ({
    ...item,
    ...(validFilter.kind === 'category' ? { categoryId: validFilter.id } : {}),
    ...(validFilter.kind === 'tag' ? { tagIds: [validFilter.id] } : {}),
  });

  const addLink = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.url.trim()) return;
    const item = withCurrentGroup({ id: createChannelId(), url: draft.url.trim(), title: draft.title.trim(), note: draft.note.trim(), createdAt: new Date().toISOString() });
    onChange({ ...docRef.current, links: [...docRef.current.links, item] });
    setDraft(emptyDraft);
  };

  const importLinks = (text: string) => {
    const parsed = parseChannelLinks(text);
    if (!parsed.length) { showToast(t('channel.noImportableLinks')); return; }
    const createdAt = new Date().toISOString();
    onChange({ ...docRef.current, links: [...docRef.current.links, ...parsed.map((item) => withCurrentGroup({ ...item, id: createChannelId(), createdAt }))] });
    showToast(t('channel.linksImported', { count: parsed.length }));
    setBulkOpen(false); setBulkText('');
  };

  const importClipboard = async () => {
    try {
      let text: string;
      try { text = await readText(); } catch { text = await navigator.clipboard.readText(); }
      importLinks(text);
    } catch { showToast(t('channel.clipboardReadFailed')); }
  };

  const markdownLink = (item: ChannelLinkItem) => `[${(item.title || item.url).replace(/([\\\]])/g, '\\$1')}](${item.url})`;
  const copyText = async (text: string) => {
    setMenu(null);
    try {
      try { await writeText(text); } catch { await navigator.clipboard.writeText(text); }
      showToast(t('channel.linksCopied'));
    } catch { showToast(t('channel.copyFailed')); }
  };

  const deleteLink = (id: string) => {
    onChange({ ...docRef.current, links: docRef.current.links.filter((item) => item.id !== id) });
    setMenu(null);
  };

  const saveLink = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing?.url.trim()) return;
    onChange({ ...docRef.current, links: docRef.current.links.map((item) => item.id === editing.id ? {
      ...item, url: editing.url.trim(), title: editing.title.trim(), note: editing.note.trim(),
      categoryId: categories.some((group) => group.id === editing.categoryId) ? editing.categoryId : undefined,
      tagIds: (editing.tagIds ?? []).filter((id) => tags.some((group) => group.id === id)),
    } : item) });
    setEditing(null);
  };

  const groupKey = (kind: BookmarkGroupKind) => kind === 'category' ? 'linkCategories' : 'linkTags';
  const duplicateName = !!groupEditor && (doc[groupKey(groupEditor.kind)] ?? []).some((group) => group.id !== groupEditor.id && group.name.toLocaleLowerCase() === groupEditor.name.trim().toLocaleLowerCase());
  const saveGroup = (event: React.FormEvent) => {
    event.preventDefault();
    if (!groupEditor?.name.trim() || duplicateName) return;
    const key = groupKey(groupEditor.kind);
    const groups = docRef.current[key] ?? [];
    const name = groupEditor.name.trim();
    const id = groupEditor.id ?? createChannelId();
    onChange({ ...docRef.current, [key]: groupEditor.id ? groups.map((group) => group.id === id ? { ...group, name } : group) : [...groups, { id, name }] });
    setGroupEditor(null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over || active.id === over.id) return;
    const source = active.data.current;
    const target = over.data.current;
    if (!source || !target) return;
    const current = docRef.current;
    if (source.kind === 'link') {
      if (target.kind === 'category' || target.kind === 'tag' || target.kind === 'uncategorized') {
        onChange(assignBookmark(current, source.linkId, target.kind === 'tag' ? 'tag' : 'category', target.groupId ?? null));
        showToast(t(target.kind === 'tag' ? 'bookmarks.tagAdded' : 'bookmarks.categoryChanged'));
      } else if (target.kind === 'link') {
        onChange({ ...current, links: reorderBookmarks(current.links, visible.map((item) => item.id), source.linkId, target.linkId) });
      }
    } else if (source.kind === target.kind && (source.kind === 'category' || source.kind === 'tag')) {
      const key = groupKey(source.kind);
      const groups = current[key] ?? [];
      const from = groups.findIndex((group) => group.id === source.groupId);
      const to = groups.findIndex((group) => group.id === target.groupId);
      if (from >= 0 && to >= 0) onChange({ ...current, [key]: arrayMove(groups, from, to) });
    }
  };

  const menuLink = menu?.kind === 'link' ? doc.links.find((item) => item.id === menu.id) : undefined;
  const menuGroup = menu && menu.kind !== 'link' ? (doc[groupKey(menu.kind)] ?? []).find((group) => group.id === menu.id) : undefined;

  const selectGroup = (kind: BookmarkGroupKind, id: string) => {
    setFilter({ kind, id });
    if (navigationMode !== kind) onChange({ ...docRef.current, linkNavigationMode: kind });
  };

  const renderTitle = (item: ChannelLinkItem) => isExternalHref(item.url)
    ? <a href={item.url} className="channel-chat-inline-link" onClick={(event: React.MouseEvent) => { event.preventDefault(); void openExternalLink(item.url); }}>{item.title || item.url}</a>
    : <span>{item.title || item.url}</span>;
  const renderCategory = (item: ChannelLinkItem) => categories.filter((group) => group.id === item.categoryId).map((group) => (
    <button type="button" key={group.id} className="bookmark-badge category" onClick={() => selectGroup('category', group.id)}><Folder size={11} />{group.name}</button>
  ));
  const renderTags = (item: ChannelLinkItem) => tags.filter((group) => item.tagIds?.includes(group.id)).map((group) => (
    <button type="button" key={group.id} className="bookmark-badge" onClick={() => selectGroup('tag', group.id)}><Tag size={11} />{group.name}</button>
  ));
  const renderTime = (item: ChannelLinkItem) => {
    const date = new Date(item.createdAt);
    return <time dateTime={item.createdAt}>{Number.isNaN(date.getTime()) ? item.createdAt : date.toLocaleString()}</time>;
  };
  const renderActions = (item: ChannelLinkItem) => <div className="bookmark-item-actions">
    <button type="button" className="channel-row-delete channel-link-menu-button" aria-label={t('channel.linkActions')} title={t('channel.linkActions')} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenu({ kind: 'link', id: item.id, x: rect.left, y: rect.bottom }); }}><MoreHorizontal size={16} /></button>
    <button type="button" className="channel-row-delete" aria-label={t('channel.deleteLink')} title={t('channel.deleteLink')} onClick={() => deleteLink(item.id)}><Trash2 size={13} /></button>
  </div>;
  const renderBookmark = (item: ChannelLinkItem) => <BookmarkRow key={item.id} item={item} view={view} dragLabel={t('bookmarks.dragBookmark')} onMenu={(x, y) => setMenu({ kind: 'link', id: item.id, x, y })}>
    {view === 'table' ? <>
      <td className="bookmark-table-title">{renderTitle(item)}</td>
      <td className="bookmark-table-url"><span title={item.url}>{item.url}</span></td>
      <td className="bookmark-table-note"><span>{item.note || '—'}</span></td>
      <td><div className="bookmark-badges">{categories.some((group) => group.id === item.categoryId) ? renderCategory(item) : <span className="bookmark-muted">{t('bookmarks.uncategorized')}</span>}</div></td>
      <td><div className="bookmark-badges">{renderTags(item)}</div></td>
      <td className="bookmark-table-date">{renderTime(item)}</td>
      <td>{renderActions(item)}</td>
    </> : <>
      <div className="channel-link-main">
        {view === 'cards' && <div className="bookmark-card-icon"><Link2 size={19} /></div>}
        {renderTitle(item)}
        {item.title && item.url !== item.title && <span className="channel-link-url" title={item.url}>{item.url}</span>}
        {item.note && <p className="channel-link-note">{item.note}</p>}
        {(item.categoryId || !!item.tagIds?.length) && <div className="bookmark-badges">{renderCategory(item)}{renderTags(item)}</div>}
        {renderTime(item)}
      </div>
      {renderActions(item)}
    </>}
  </BookmarkRow>;

  return (
    <DndContext sensors={sensors} collisionDetection={bookmarkCollision} onDragStart={({ active }) => {
      setMenu(null);
      setDragging({ kind: active.data.current?.kind ?? '', name: active.data.current?.name ?? '' });
    }} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className={`bookmark-layout${collapsed ? ' navigation-collapsed' : ''}`}>
        {!collapsed && <nav id="bookmark-navigation" className="bookmark-navigation" aria-label={t('bookmarks.navigation')}>
          <div className="bookmark-nav-heading"><strong>{t('bookmarks.navigation')}</strong><button type="button" className="bookmark-icon-button" onClick={() => onChange({ ...docRef.current, linkNavigationCollapsed: true })} aria-label={t('bookmarks.collapse')} title={t('bookmarks.collapse')} aria-expanded="true" aria-controls="bookmark-navigation"><PanelLeftClose size={16} /></button></div>
          <button type="button" className={`bookmark-nav-fixed${validFilter.kind === 'all' ? ' selected' : ''}`} onClick={() => setFilter({ kind: 'all' })} aria-current={validFilter.kind === 'all' ? 'page' : undefined}>
            <Layers size={15} /><span>{t('bookmarks.all')}</span><small>{doc.links.length}</small>
          </button>
          <div className="bookmark-segmented bookmark-navigation-switch" role="group" aria-label={t('bookmarks.navigationMode')}>
            {(['category', 'tag'] as const).map((kind) => <button key={kind} type="button" aria-pressed={navigationMode === kind} onClick={() => {
              setFilter({ kind: 'all' }); setMenu(null);
              onChange({ ...docRef.current, linkNavigationMode: kind });
            }}>{t(kind === 'category' ? 'bookmarks.categories' : 'bookmarks.tags')}</button>)}
          </div>
          {navigationMode === 'category' && <UncategorizedRow selected={validFilter.kind === 'uncategorized'} count={filterBookmarks(doc, { kind: 'uncategorized' }).length} label={t('bookmarks.uncategorized')} onSelect={() => setFilter({ kind: 'uncategorized' })} />}
          <section className="bookmark-nav-section" aria-label={t(navigationMode === 'category' ? 'bookmarks.categories' : 'bookmarks.tags')}>
            <div className="bookmark-nav-heading"><strong>{t(navigationMode === 'category' ? 'bookmarks.categories' : 'bookmarks.tags')}</strong><button type="button" className="bookmark-icon-button" onClick={() => setGroupEditor({ kind: navigationMode, name: '' })} aria-label={t(navigationMode === 'category' ? 'bookmarks.addCategory' : 'bookmarks.addTag')} title={t(navigationMode === 'category' ? 'bookmarks.addCategory' : 'bookmarks.addTag')}><Plus size={15} /></button></div>
            <SortableContext items={navigationGroups.map((group) => navId(navigationMode, group.id))} strategy={verticalListSortingStrategy}>
              {navigationGroups.map((group) => <NavigationRow key={group.id} group={group} kind={navigationMode} selected={validFilter.kind === navigationMode && 'id' in validFilter && validFilter.id === group.id}
                count={doc.links.filter((item) => navigationMode === 'category' ? item.categoryId === group.id : item.tagIds?.includes(group.id)).length}
                dragLabel={t(navigationMode === 'category' ? 'bookmarks.reorderCategory' : 'bookmarks.reorderTag')}
                menuLabel={t('bookmarks.groupActions', { name: group.name })}
                onSelect={() => setFilter({ kind: navigationMode, id: group.id })} onMenu={(x, y) => setMenu({ kind: navigationMode, id: group.id, x, y })} />)}
            </SortableContext>
            {!navigationGroups.length && <button type="button" className="bookmark-nav-add" onClick={() => setGroupEditor({ kind: navigationMode, name: '' })}><Plus size={13} />{t(navigationMode === 'category' ? 'bookmarks.addCategory' : 'bookmarks.addTag')}</button>}
          </section>
          <p className="bookmark-nav-hint">{t('bookmarks.dragHint')}</p>
        </nav>}
        <div className="channel-side-panel bookmark-content">
          <div className="bookmark-content-heading">
            {collapsed && <button type="button" className="bookmark-icon-button" aria-label={t('bookmarks.expand')} title={t('bookmarks.expand')} aria-expanded="false" onClick={() => onChange({ ...docRef.current, linkNavigationCollapsed: false })}><PanelLeftOpen size={17} /></button>}
            {validFilter.kind === 'tag' ? <Tag size={16} /> : validFilter.kind === 'category' || validFilter.kind === 'uncategorized' ? <Folder size={16} /> : <Layers size={16} />}
            <h4>{selectedName}</h4><span className="bookmark-count">{visible.length}</span>
            <div className="bookmark-segmented bookmark-view-switch" role="group" aria-label={t('bookmarks.viewMode')}>
              {(['table', 'cards', 'list'] as const).map((mode) => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => onChange({ ...docRef.current, linkView: mode })}>{t(`bookmarks.view.${mode}`)}</button>)}
            </div>
          </div>
          <form className="channel-side-form channel-side-form-grid" onSubmit={addLink}>
            <input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder={t('channel.linkUrl')} aria-label={t('channel.linkUrl')} />
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={t('channel.linkTitle')} aria-label={t('channel.linkTitle')} />
            <input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder={t('channel.linkNote')} aria-label={t('channel.linkNote')} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!draft.url.trim()}>{t('channel.addLink')}</button>
          </form>
          <div className="channel-link-import-actions">
            <button type="button" className="btn btn-sm" onClick={() => void importClipboard()}>{t('channel.importFromClipboard')}</button>
            <button type="button" className="btn btn-sm" onClick={() => setBulkOpen(true)}>{t('channel.bulkImportLinks')}</button>
            {doc.links.length > 0 && <button type="button" className="btn btn-sm" onClick={() => void copyText(doc.links.map(markdownLink).join('\n'))}>{t('channel.copyAllMarkdownLinks')}</button>}
          </div>
          {!visible.length && <p className="channel-side-empty">{t(doc.links.length ? 'bookmarks.emptyFilter' : 'channel.emptyLinks')}</p>}
          <SortableContext items={visible.map((item) => linkId(item.id))} strategy={view === 'cards' ? rectSortingStrategy : verticalListSortingStrategy}>
            {view === 'table' ? <div className="bookmark-table-scroll">
              <table className="bookmark-table" aria-label={t('bookmarks.view.table')}>
                <thead><tr><th scope="col"><span className="sr-only">{t('bookmarks.dragBookmark')}</span></th>
                  {(['title', 'url', 'note', 'category', 'tags', 'createdAt', 'actions'] as const).map((key) => <th scope="col" key={key}>{t(`bookmarks.${key}`)}</th>)}
                </tr></thead>
                <tbody>{visible.map(renderBookmark)}</tbody>
              </table>
            </div> : <ul className={`channel-link-list bookmark-items bookmark-items-${view}`}>{visible.map(renderBookmark)}</ul>}
          </SortableContext>
        </div>
      </div>
      {createPortal(<DragOverlay dropAnimation={null}>{dragging && <div className={`bookmark-drag-preview ${dragging.kind}`}><GripVertical size={14} />{dragging.kind === 'link' ? <Link2 size={15} /> : dragging.kind === 'tag' ? <Tag size={15} /> : <Folder size={15} />}<span>{dragging.name}</span></div>}</DragOverlay>, document.body)}

      {editing && <div className="modal-overlay" onClick={() => setEditing(null)}>
        <form className="modal channel-link-edit-modal bookmark-edit-modal" role="dialog" aria-modal="true" aria-label={t('channel.editLink')} onClick={(event) => event.stopPropagation()} onSubmit={saveLink}>
          <h2 className="modal-title">{t('channel.editLink')}</h2>
          <label className="channel-link-edit-field"><span>{t('channel.linkUrl')}</span><input autoFocus value={editing.url} onChange={(event) => setEditing({ ...editing, url: event.target.value })} placeholder={t('channel.linkUrl')} /></label>
          <label className="channel-link-edit-field"><span>{t('channel.linkTitle')}</span><input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} placeholder={t('channel.linkTitle')} /></label>
          <label className="channel-link-edit-field"><span>{t('channel.linkNote')}</span><textarea value={editing.note} onChange={(event) => setEditing({ ...editing, note: event.target.value })} placeholder={t('channel.linkNote')} /></label>
          <label className="channel-link-edit-field"><span>{t('bookmarks.category')}</span><select value={categories.some((group) => group.id === editing.categoryId) ? editing.categoryId : ''} onChange={(event) => setEditing({ ...editing, categoryId: event.target.value || undefined })}><option value="">{t('bookmarks.uncategorized')}</option>{categories.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
          <fieldset className="bookmark-tag-picker"><legend>{t('bookmarks.tags')}</legend>{tags.length ? tags.map((group) => <label key={group.id}><input type="checkbox" checked={editing.tagIds?.includes(group.id) ?? false} onChange={(event) => setEditing({ ...editing, tagIds: event.target.checked ? [...(editing.tagIds ?? []), group.id] : (editing.tagIds ?? []).filter((id) => id !== group.id) })} /><span>{group.name}</span></label>) : <span className="bookmark-nav-hint">{t('bookmarks.noTags')}</span>}</fieldset>
          <div className="channel-link-import-footer"><button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>{t('common.cancel')}</button><button type="submit" className="btn btn-primary btn-sm" disabled={!editing.url.trim()}>{t('channel.saveLink')}</button></div>
        </form>
      </div>}

      {bulkOpen && <div className="modal-overlay" onClick={() => setBulkOpen(false)}><div className="modal channel-link-import-modal" role="dialog" aria-modal="true" aria-label={t('channel.bulkImportLinks')} onClick={(event) => event.stopPropagation()}>
        <h2 className="modal-title">{t('channel.bulkImportLinks')}</h2><p className="modal-message">{t('channel.bulkImportHint')}</p>
        <textarea autoFocus value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder={t('channel.bulkImportPlaceholder')} aria-label={t('channel.bulkImportLinks')} />
        <div className="channel-link-import-footer"><button type="button" className="btn btn-sm" onClick={() => setBulkOpen(false)}>{t('common.cancel')}</button><button type="button" className="btn btn-primary btn-sm" disabled={!bulkText.trim()} onClick={() => importLinks(bulkText)}>{t('channel.startImport')}</button></div>
      </div></div>}

      {groupEditor && <div className="modal-overlay" onClick={() => setGroupEditor(null)}><form className="modal channel-link-edit-modal" role="dialog" aria-modal="true" aria-label={t(groupEditor.id ? 'bookmarks.rename' : groupEditor.kind === 'category' ? 'bookmarks.addCategory' : 'bookmarks.addTag')} onClick={(event) => event.stopPropagation()} onSubmit={saveGroup}>
        <h2 className="modal-title">{t(groupEditor.id ? 'bookmarks.rename' : groupEditor.kind === 'category' ? 'bookmarks.addCategory' : 'bookmarks.addTag')}</h2>
        <label className="channel-link-edit-field"><span>{t(groupEditor.kind === 'category' ? 'bookmarks.categoryName' : 'bookmarks.tagName')}</span><input autoFocus value={groupEditor.name} aria-invalid={duplicateName} aria-describedby={duplicateName ? 'bookmark-group-name-error' : undefined} onChange={(event) => setGroupEditor({ ...groupEditor, name: event.target.value })} /></label>
        {duplicateName && <p id="bookmark-group-name-error" className="bookmark-form-error">{t('bookmarks.nameExists')}</p>}
        <div className="channel-link-import-footer"><button type="button" className="btn btn-sm" onClick={() => setGroupEditor(null)}>{t('common.cancel')}</button><button type="submit" className="btn btn-primary btn-sm" disabled={!groupEditor.name.trim() || duplicateName}>{t('channel.saveLink')}</button></div>
      </form></div>}

      {menu && <ContextMenuPortal x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
        {menuLink && <>
          <button className="context-menu-item" onClick={() => { setEditing({ ...menuLink }); setMenu(null); }}><Pencil size={14} />{t('channel.editLink')}</button>
          <button className="context-menu-item" onClick={() => void copyText(markdownLink(menuLink))}><Copy size={14} />{t('channel.copyMarkdownLink')}</button>
          <button className="context-menu-item" onClick={() => void copyText(`${menuLink.title || menuLink.url} | ${menuLink.url}`)}><Copy size={14} />{t('channel.copyTitlePipeLink')}</button>
          <button className="context-menu-item" onClick={() => void copyText(`${menuLink.title || menuLink.url} - ${menuLink.url}`)}><Copy size={14} />{t('channel.copyTitleDashLink')}</button>
          <div className="context-menu-divider" /><button className="context-menu-item danger" onClick={() => deleteLink(menuLink.id)}><Trash2 size={14} />{t('channel.deleteLink')}</button>
        </>}
        {menuGroup && menu.kind !== 'link' && <>
          <button className="context-menu-item" onClick={() => { setGroupEditor({ kind: menu.kind as BookmarkGroupKind, ...menuGroup }); setMenu(null); }}><Pencil size={14} />{t('bookmarks.rename')}</button>
          <button className="context-menu-item danger" title={t('bookmarks.deleteGroupHint')} onClick={() => {
            onChange(removeBookmarkGroup(docRef.current, menu.kind as BookmarkGroupKind, menuGroup.id));
            if ('id' in filter && filter.kind === menu.kind && filter.id === menuGroup.id) setFilter({ kind: 'all' });
            setMenu(null);
          }}><Trash2 size={14} />{t('bookmarks.deleteGroup')}</button>
        </>}
      </ContextMenuPortal>}
    </DndContext>
  );
};

export default BookmarkPanel;
