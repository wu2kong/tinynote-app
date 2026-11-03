import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import React, {
  useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent,
} from 'react';
import {
  Copy, StickyNote, GripVertical, Check, Link2, MessageSquare, MoreHorizontal, Pencil, PanelLeftClose, PanelLeftOpen, Paperclip, Search, Send, Settings, Trash2, Users, X,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n/useI18n';
import { registerDocumentSaveFlusher } from '@/utils/documentSaveFlush';
import {
  createChannelId,
  createChannelMessage,
  normalizeEnabledTabs,
  REQUIRED_CHANNEL_TABS,
  DEFAULT_SELF_MEMBER_ID,
  getSelfMemberId,
  parseChannelDocument,
  serializeChannelDocument,
  type ChannelDocument,
  type ChannelLinkItem,
  type ChannelMember,
  type ChannelMessage,
  type ChannelResourceItem,
  type ChannelTabId,
  type ChannelTodoItem,
} from '@/utils/channelDocument';
import { isExternalHref, openExternalLink } from '@/utils/openExternalLink';
import { renderInlineLinkText } from '@/utils/renderInlineLinks';
import { parseChannelLinks } from '@/utils/parseChannelLinks';
import { showToast } from './Toast';
import ContextMenuPortal from './ContextMenuPortal';
import ChannelTodosPanel from './ChannelTodosPanel';

const SAVE_DEBOUNCE_MS = 400;

const TAB_DEFS: { id: ChannelTabId; labelKey: string; icon: React.ReactNode }[] = [
  { id: 'chat', labelKey: 'channel.tabs.chat', icon: <MessageSquare size={14} /> },
  { id: 'todos', labelKey: 'channel.tabs.todos', icon: <Check size={14} /> },
  { id: 'links', labelKey: 'channel.tabs.links', icon: <Link2 size={14} /> },
  { id: 'resources', labelKey: 'channel.tabs.resources', icon: <Paperclip size={14} /> },
  { id: 'members', labelKey: 'channel.tabs.members', icon: <Users size={14} /> },
  { id: 'settings', labelKey: 'channel.tabs.settings', icon: <Settings size={14} /> },
];

function formatSentAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

interface ChannelMessageContentProps {
  content: string;
  editing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onChange: (content: string) => void;
}

const ChannelMessageContent: React.FC<ChannelMessageContentProps> = ({
  content,
  editing,
  onStartEdit,
  onEndEdit,
  onChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
    }
  }, [editing]);

  return (
    <div className="channel-chat-content-sizer">
      <div className="channel-chat-content-measure" aria-hidden="true">
        {content}{'\u200b'}
      </div>
      {editing ? (
        <textarea
          ref={textareaRef}
          className="channel-chat-content"
          value={content}
          rows={1}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onEndEdit}
          spellCheck
        />
      ) : (
        <div
          className="channel-chat-content-preview"
          onClick={onStartEdit}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onStartEdit();
            }
          }}
          role="button"
          tabIndex={0}
        >
          {content
            ? renderInlineLinkText(content, 'channel-chat-inline-link')
            : ''}{'\u200b'}
        </div>
      )}
    </div>
  );
};

const SortableMessage: React.FC<{ id: string; fromSelf: boolean; label: string; children: React.ReactNode }> = ({ id, fromSelf, label, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} className={`channel-chat-message-row${fromSelf ? ' self' : ' other'}`}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition, position: 'relative', zIndex: isDragging ? 1 : undefined, opacity: isDragging ? 0.7 : 1 }}>
      <button type="button" className="channel-chat-drag" {...attributes} {...listeners} aria-label={label} title={label}><GripVertical size={14} /></button>
      {children}
    </div>
  );
};

const SortableLink: React.FC<{ id: string; label: string; onMenu: (x: number, y: number) => void; children: React.ReactNode }> = ({ id, label, onMenu, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <li ref={setNodeRef} className="channel-sortable-link"
    onContextMenu={(event) => { event.preventDefault(); onMenu(event.clientX, event.clientY); }}
    style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition, opacity: isDragging ? 0.5 : 1, position: 'relative', zIndex: isDragging ? 1 : undefined }}>
    <button type="button" className="channel-link-drag" {...attributes} {...listeners} aria-label={label} title={label}><GripVertical size={15} /></button>
    {children}
  </li>;
};

const ChannelNotebookPanel: React.FC = () => {
  const { t } = useI18n();
  const currentNotebook = useStore((s) => s.currentNotebook);
  const showDirectoryPanel = useStore((s) => s.showDirectoryPanel);
  const showAppBar = useStore((s) => s.showAppBar);
  const toggleDirectoryPanel = useStore((s) => s.toggleDirectoryPanel);
  const updateNotebookContent = useStore((s) => s.updateNotebookContent);

  const selfMemberNameFallback = t('channel.selfMemberName');
  const defaultMessageType = t('channel.defaultMessageType');

  const [doc, setDoc] = useState<ChannelDocument>(() => parseChannelDocument('', selfMemberNameFallback));
  const [activeTab, setActiveTab] = useState<ChannelTabId>('chat');
  const enabledTabs = normalizeEnabledTabs(doc.enabledTabs);
  const [activeAuthorId, setActiveAuthorId] = useState(DEFAULT_SELF_MEMBER_ID);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const [draft, setDraft] = useState('');
  const [searchText, setSearchText] = useState('');
  const searchQuery = searchText.trim().toLowerCase();
  const filteredMessages = useMemo(() => (
    searchQuery
      ? doc.messages.filter((message) => message.content.toLowerCase().includes(searchQuery))
      : doc.messages
  ), [doc.messages, searchQuery]);
  const [memberDraft, setMemberDraft] = useState('');
  const [linkDraft, setLinkDraft] = useState({ url: '', title: '', note: '' });
  const [bulkLinksOpen, setBulkLinksOpen] = useState(false);
  const [bulkLinksText, setBulkLinksText] = useState('');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkDraft, setEditingLinkDraft] = useState({ url: '', title: '', note: '' });
  const [linkMenu, setLinkMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [resourceDraft, setResourceDraft] = useState({ name: '', kind: '', uri: '', note: '' });
  const [messageMenu, setMessageMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const [remarkMenu, setRemarkMenu] = useState<{ messageId: string; remarkId: string; x: number; y: number } | null>(null);
  const [remarkTargetId, setRemarkTargetId] = useState<string | null>(null);
  const [remarkDraft, setRemarkDraft] = useState('');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notebookPathRef = useRef<string | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const updateNotebookContentRef = useRef(updateNotebookContent);
  updateNotebookContentRef.current = updateNotebookContent;

  const selfMemberId = useMemo(() => getSelfMemberId(doc.members), [doc.members]);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of doc.members) {
      map.set(member.id, member.name);
    }
    return map;
  }, [doc.members]);

  const flushPendingSave = useCallback((): Promise<void> => {
    if (!saveTimerRef.current) return Promise.resolve();
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const path = notebookPathRef.current;
    if (!path) return Promise.resolve();
    return updateNotebookContentRef.current(serializeChannelDocument(docRef.current), path);
  }, []);

  const flushPendingSaveRef = useRef(flushPendingSave);
  flushPendingSaveRef.current = flushPendingSave;

  const scheduleSave = useCallback((nextDoc: ChannelDocument) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const path = notebookPathRef.current;
      if (!path) return;
      void updateNotebookContentRef.current(serializeChannelDocument(nextDoc), path);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const applyDoc = useCallback((nextDoc: ChannelDocument) => {
    docRef.current = nextDoc;
    setDoc(nextDoc);
    scheduleSave(nextDoc);
  }, [scheduleSave]);

  useEffect(() => {
    if (!currentNotebook || currentNotebook.format !== 'channel') return;
    const content = currentNotebook.content ?? '';

    if (notebookPathRef.current !== currentNotebook.path) {
      void flushPendingSaveRef.current();
      notebookPathRef.current = currentNotebook.path;
      const parsed = parseChannelDocument(content, selfMemberNameFallback);
      setDoc(parsed);
      setActiveAuthorId(getSelfMemberId(parsed.members));
      setDraft('');
      setSearchText('');
      setMemberDraft('');
      setActiveTab('chat');
      setEditingMessageId(null);
      setRemarkTargetId(null);
      setRemarkDraft('');
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    } else if (content !== serializeChannelDocument(docRef.current)) {
      const parsed = parseChannelDocument(content, selfMemberNameFallback);
      setDoc(parsed);
    }
  }, [currentNotebook, selfMemberNameFallback]);

  useEffect(() => {
    if (doc.members.some((member) => member.id === activeAuthorId)) return;
    setActiveAuthorId(selfMemberId);
  }, [activeAuthorId, doc.members, selfMemberId]);

  useEffect(() => registerDocumentSaveFlusher(() => flushPendingSaveRef.current()), []);

  useEffect(() => () => {
    void flushPendingSaveRef.current();
  }, [currentNotebook?.path]);

  useEffect(() => {
    if (activeTab !== 'chat' || searchQuery) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [doc.messages.length, activeTab, searchQuery]);

  useEffect(() => {
    if (activeTab === 'chat') composerRef.current?.focus();
  }, [currentNotebook?.path, activeTab]);

  useEffect(() => { setMessageMenu(null); setRemarkMenu(null); }, [currentNotebook?.path, activeTab]);
  useEffect(() => {
    if (!enabledTabs.includes(activeTab)) setActiveTab('chat');
  }, [activeTab, doc.enabledTabs]);

  useEffect(() => {
    if (!messageMenu && !remarkMenu) return;
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { setMessageMenu(null); setRemarkMenu(null); }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [messageMenu, remarkMenu]);

  const sendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const authorId = docRef.current.members.some((m) => m.id === activeAuthorId)
      ? activeAuthorId
      : getSelfMemberId(docRef.current.members);
    const message = createChannelMessage(text, authorId, defaultMessageType);
    applyDoc({ ...docRef.current, messages: [...docRef.current.messages, message] });
    setDraft('');
    composerRef.current?.focus();
  }, [activeAuthorId, applyDoc, defaultMessageType, draft]);

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const updateMessage = (id: string, patch: Partial<ChannelMessage>) => {
    applyDoc({
      ...docRef.current,
      messages: docRef.current.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  };

  const deleteMessage = (id: string) => {
    applyDoc({
      ...docRef.current,
      messages: docRef.current.messages.filter((m) => m.id !== id),
    });
  };

  const copyMessage = async (id: string) => {
    const message = docRef.current.messages.find((item) => item.id === id);
    setMessageMenu(null);
    if (!message) return;
    try {
      try {
        await writeText(message.content);
      } catch {
        await navigator.clipboard.writeText(message.content);
      }
      showToast(t('channel.messageCopied'));
    } catch {
      showToast(t('channel.copyFailed'));
    }
  };

  const addRemark = (id: string) => {
    const text = remarkDraft.trim();
    const message = docRef.current.messages.find((item) => item.id === id);
    if (!text || !message) return;
    updateMessage(id, { remarks: [...(message.remarks ?? []), {
      id: createChannelId(), text, createdAt: new Date().toISOString(),
    }] });
    setRemarkDraft('');
    setRemarkTargetId(null);
  };

  const addMessageTodo = (id: string) => {
    const message = docRef.current.messages.find((item) => item.id === id);
    setMessageMenu(null);
    if (!message?.content.trim()) {
      showToast(t('common.emptyContent'));
      return;
    }
    const item: ChannelTodoItem = {
      id: createChannelId(), text: message.content, done: false, createdAt: new Date().toISOString(), sourceMessageId: message.id,
    };
    applyDoc({ ...docRef.current, todos: [...docRef.current.todos, item] });
    showToast(t('channel.todoAdded'));
  };

  const resolveMemberName = (authorId: string) => (
    memberNameById.get(authorId) ?? t('channel.unknownMember')
  );

  const isMessageFromSelf = (message: ChannelMessage) => (
    (message.authorId || selfMemberId) === selfMemberId
  );

  const addMember = () => {
    const name = memberDraft.trim();
    if (!name) return;
    const exists = docRef.current.members.some(
      (member) => member.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      showToast(t('channel.memberExists'));
      return;
    }
    const member: ChannelMember = { id: createChannelId(), name };
    applyDoc({ ...docRef.current, members: [...docRef.current.members, member] });
    setMemberDraft('');
  };

  const renameMember = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    applyDoc({
      ...docRef.current,
      members: docRef.current.members.map((member) => (
        member.id === id ? { ...member, name: trimmed } : member
      )),
    });
  };

  const deleteMember = (id: string) => {
    const target = docRef.current.members.find((member) => member.id === id);
    if (!target || target.isSelf) return;
    applyDoc({
      ...docRef.current,
      members: docRef.current.members.filter((member) => member.id !== id),
      messages: docRef.current.messages.map((message) => (
        message.authorId === id ? { ...message, authorId: selfMemberId } : message
      )),
    });
    if (activeAuthorId === id) {
      setActiveAuthorId(selfMemberId);
    }
  };

  const addLink = () => {
    const url = linkDraft.url.trim();
    if (!url) return;
    const item: ChannelLinkItem = {
      id: createChannelId(),
      url,
      title: linkDraft.title.trim(),
      note: linkDraft.note.trim(),
      createdAt: new Date().toISOString(),
    };
    applyDoc({ ...docRef.current, links: [...docRef.current.links, item] });
    setLinkDraft({ url: '', title: '', note: '' });
  };

  const importLinks = (text: string) => {
    const parsed = parseChannelLinks(text);
    if (!parsed.length) { showToast(t('channel.noImportableLinks')); return; }
    const createdAt = new Date().toISOString();
    applyDoc({
      ...docRef.current,
      links: [...docRef.current.links, ...parsed.map((item) => ({ ...item, id: createChannelId(), createdAt }))],
    });
    showToast(t('channel.linksImported', { count: parsed.length }));
    setBulkLinksOpen(false);
    setBulkLinksText('');
  };

  const importLinksFromClipboard = async () => {
    try {
      let text: string;
      try { text = await readText(); }
      catch { text = await navigator.clipboard.readText(); }
      importLinks(text);
    } catch { showToast(t('channel.clipboardReadFailed')); }
  };

  const deleteLink = (id: string) => {
    applyDoc({
      ...docRef.current,
      links: docRef.current.links.filter((item) => item.id !== id),
    });
  };

  const startEditingLink = (item: ChannelLinkItem) => {
    setEditingLinkId(item.id);
    setEditingLinkDraft({ url: item.url, title: item.title, note: item.note });
    setLinkMenu(null);
  };

  const saveEditedLink = () => {
    const url = editingLinkDraft.url.trim();
    if (!editingLinkId || !url) return;
    applyDoc({ ...docRef.current, links: docRef.current.links.map((item) => item.id === editingLinkId
      ? { ...item, url, title: editingLinkDraft.title.trim(), note: editingLinkDraft.note.trim() } : item) });
    setEditingLinkId(null);
  };

  const markdownLink = (item: ChannelLinkItem) => `[${(item.title || item.url).replace(/([\\\]])/g, '\\$1')}](${item.url})`;
  const copyLinkText = async (text: string) => {
    setLinkMenu(null);
    try {
      try { await writeText(text); } catch { await navigator.clipboard.writeText(text); }
      showToast(t('channel.linksCopied'));
    } catch { showToast(t('channel.copyFailed')); }
  };

  const addResource = () => {
    const name = resourceDraft.name.trim();
    if (!name) return;
    const item: ChannelResourceItem = {
      id: createChannelId(),
      name,
      kind: resourceDraft.kind.trim(),
      uri: resourceDraft.uri.trim(),
      note: resourceDraft.note.trim(),
      createdAt: new Date().toISOString(),
    };
    applyDoc({ ...docRef.current, resources: [...docRef.current.resources, item] });
    setResourceDraft({ name: '', kind: '', uri: '', note: '' });
  };

  const deleteResource = (id: string) => {
    applyDoc({
      ...docRef.current,
      resources: docRef.current.resources.filter((item) => item.id !== id),
    });
  };

  if (!currentNotebook || currentNotebook.format !== 'channel') {
    return (
      <div className="channel-notebook-panel">
        <div className="channel-notebook-empty">{t('note.selectNotebook')}</div>
      </div>
    );
  }

  const leftPanelVisible = showDirectoryPanel || showAppBar;

  return (
    <div className="channel-notebook-panel">
      <div className="channel-notebook-header">
        <div className="channel-notebook-header-left">
          <button
            type="button"
            className="left-panel-toggle"
            onClick={toggleDirectoryPanel}
            title={leftPanelVisible ? t('app.hideSidebar') : t('app.showSidebar')}
          >
            {leftPanelVisible ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div className="channel-notebook-title-wrap">
            <h3>{doc.title.trim() || currentNotebook.name}</h3>
            {doc.subtitle.trim() ? (
              <p className="channel-notebook-subtitle">{doc.subtitle.trim()}</p>
            ) : (
              <span className="channel-notebook-format-badge">{t('directory.formats.channel')}</span>
            )}
          </div>
        </div>
      </div>

      <div className="channel-notebook-toolbar">
        <div className="channel-notebook-tabs" role="tablist" aria-label={t('channel.tabsLabel')}>
          {TAB_DEFS.filter(({ id }) => enabledTabs.includes(id)).map(({ id, labelKey, icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              className={`channel-notebook-tab${activeTab === id ? ' active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              {icon}
              <span>{t(labelKey)}</span>
            </button>
          ))}
        </div>
        {activeTab === 'chat' && (
          <div className="note-panel-search channel-chat-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setSearchText('');
              }}
              placeholder={t('channel.searchMessages')}
              aria-label={t('channel.searchMessages')}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            {searchText && (
              <button
                type="button"
                className="search-clear-btn"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setSearchText('')}
                title={t('directory.clearSearch')}
                aria-label={t('directory.clearSearch')}
              >
                <X size={14} />
              </button>
            )}
            </div>
        )}
      </div>

      <div className="channel-notebook-body">
        {activeTab === 'chat' && (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={({ active, over }) => {
              if (!over || active.id === over.id) return;
              const messages = docRef.current.messages;
              const from = messages.findIndex((message) => message.id === active.id);
              const to = messages.findIndex((message) => message.id === over.id);
              if (from >= 0 && to >= 0) applyDoc({ ...docRef.current, messages: arrayMove(messages, from, to) });
            }}>
            <SortableContext items={filteredMessages.map((message) => message.id)} strategy={verticalListSortingStrategy}>
            <div className="channel-chat-messages">
              {filteredMessages.length === 0 ? (
                <div className="channel-chat-empty" role="status">
                  <MessageSquare size={28} strokeWidth={1.4} />
                  <p>{t(searchQuery ? 'channel.noMatchingMessages' : 'channel.emptyChat')}</p>
                </div>
              ) : (
                filteredMessages.map((message) => {
                  const fromSelf = isMessageFromSelf(message);
                  return (
                    <SortableMessage key={message.id} id={message.id} fromSelf={fromSelf} label={t('channel.reorderMessage')}>
                      {!fromSelf && doc.showMemberAvatars !== false && <span className="channel-chat-avatar" aria-hidden="true">{Array.from(resolveMemberName(message.authorId))[0]}</span>}
                      <article className="channel-chat-message" onContextMenu={(event) => {
                        event.preventDefault();
                        setRemarkMenu(null);
                        setMessageMenu({ id: message.id, x: event.clientX, y: event.clientY });
                      }}>
                        {(!fromSelf || doc.showTime !== false) && <div className="channel-chat-message-meta">
                          {!fromSelf && <span className="channel-chat-author">{resolveMemberName(message.authorId)}</span>}
                          {doc.showTime !== false && <time className="channel-chat-time" dateTime={message.sentAt}>
                            {formatSentAt(message.sentAt)}
                          </time>}
                        </div>}
                        <ChannelMessageContent
                          content={message.content}
                          editing={editingMessageId === message.id}
                          onStartEdit={() => setEditingMessageId(message.id)}
                          onEndEdit={() => setEditingMessageId(null)}
                          onChange={(value) => updateMessage(message.id, { content: value })}
                        />
                        {!!message.remarks?.length && (
                          <ul className="channel-message-remarks" aria-label={t('channel.remarks')}>
                            {message.remarks.map((remark) => (
                              <li key={remark.id} onContextMenu={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setMessageMenu(null);
                                setRemarkMenu({ messageId: message.id, remarkId: remark.id, x: event.clientX, y: event.clientY });
                              }}>
                                <StickyNote size={12} aria-hidden="true" />
                                <span>{renderInlineLinkText(remark.text, 'channel-chat-inline-link')}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {remarkTargetId === message.id && (
                          <form className="channel-remark-form" onSubmit={(event) => { event.preventDefault(); addRemark(message.id); }}>
                            <textarea
                              autoFocus
                              value={remarkDraft}
                              onChange={(event) => setRemarkDraft(event.target.value)}
                              placeholder={t('channel.remarkPlaceholder')}
                              aria-label={t('channel.addRemark')}
                              rows={2}
                              onKeyDown={(event) => {
                                if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                                if (event.key === 'Enter' && !event.shiftKey) {
                                  event.preventDefault();
                                  addRemark(message.id);
                                }
                                if (event.key === 'Escape') { setRemarkTargetId(null); setRemarkDraft(''); }
                              }}
                            />
                            <div className="channel-remark-actions">
                              <button type="button" className="btn btn-sm" onClick={() => { setRemarkTargetId(null); setRemarkDraft(''); }}>{t('common.cancel')}</button>
                              <button type="submit" className="btn btn-primary btn-sm" disabled={!remarkDraft.trim()}>{t('common.save')}</button>
                            </div>
                          </form>
                        )}
                      </article>
                    </SortableMessage>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            </SortableContext>
            </DndContext>
            <div className="channel-chat-composer">
              <textarea
                ref={composerRef}
                className="channel-chat-composer-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={t('channel.composerPlaceholder')}
                rows={1}
              />
              <div className="channel-chat-composer-actions">
                <div className="channel-chat-identity" role="group" aria-label={t('channel.sendAs')}>
                  <span>{t('channel.sendAs')}</span>
                    {doc.members.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        className="channel-chat-identity-button"
                        aria-pressed={activeAuthorId === member.id}
                        onClick={() => setActiveAuthorId(member.id)}
                      >
                        {member.name}
                        {member.isSelf ? ` (${t('channel.selfBadge')})` : ''}
                      </button>
                    ))}
                </div>
                <span className="channel-chat-hint">{t('channel.sendHint')}</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={sendMessage}>
                  <Send size={14} />
                  {t('channel.send')}
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'members' && (
          <div className="channel-side-panel">
            <div className="channel-side-form">
              <input
                value={memberDraft}
                onChange={(e) => setMemberDraft(e.target.value)}
                placeholder={t('channel.memberPlaceholder')}
                onKeyDown={(e) => { if (e.key === 'Enter') addMember(); }}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={addMember}>
                {t('channel.addMember')}
              </button>
            </div>
            <ul className="channel-member-list">
              {doc.members.map((member) => (
                <li key={member.id}>
                  <input
                    className="channel-member-name-input"
                    value={member.name}
                    onChange={(e) => renameMember(member.id, e.target.value)}
                    aria-label={t('channel.memberName')}
                  />
                  {member.isSelf && (
                    <span className="channel-member-self-badge">{t('channel.selfBadge')}</span>
                  )}
                  {!member.isSelf && (
                    <button
                      type="button"
                      className="channel-row-delete"
                      onClick={() => deleteMember(member.id)}
                      title={t('channel.deleteMember')}
                      aria-label={t('channel.deleteMember')}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'todos' && (
          <ChannelTodosPanel
            key={currentNotebook.path}
            todos={doc.todos}
            groups={doc.todoGroups ?? []}
            view={doc.todoView === 'board' ? 'board' : 'list'}
            onViewChange={(todoView) => applyDoc({ ...docRef.current, todoView })}
            onChange={(todos, todoGroups) => applyDoc({ ...docRef.current, todos, todoGroups })}
            onOpenSource={(id) => {
              const message = docRef.current.messages.find((item) => item.id === id);
              if (!message) { showToast(t('todo.sourceMissing')); return; }
              setSearchText(message.content);
              setActiveTab('chat');
            }}
          />
        )}

        {activeTab === 'links' && (
          <div className="channel-side-panel">
            <div className="channel-side-form channel-side-form-grid">
              <input
                value={linkDraft.url}
                onChange={(e) => setLinkDraft((s) => ({ ...s, url: e.target.value }))}
                placeholder={t('channel.linkUrl')}
              />
              <input
                value={linkDraft.title}
                onChange={(e) => setLinkDraft((s) => ({ ...s, title: e.target.value }))}
                placeholder={t('channel.linkTitle')}
              />
              <input
                value={linkDraft.note}
                onChange={(e) => setLinkDraft((s) => ({ ...s, note: e.target.value }))}
                placeholder={t('channel.linkNote')}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={addLink}>
                {t('channel.addLink')}
              </button>
            </div>
            <div className="channel-link-import-actions">
              <button type="button" className="btn btn-sm" onClick={() => void importLinksFromClipboard()}>{t('channel.importFromClipboard')}</button>
              <button type="button" className="btn btn-sm" onClick={() => setBulkLinksOpen(true)}>{t('channel.bulkImportLinks')}</button>
              {doc.links.length > 0 && <button type="button" className="btn btn-sm" onClick={() => void copyLinkText(docRef.current.links.map(markdownLink).join('\n'))}>{t('channel.copyAllMarkdownLinks')}</button>}
            </div>
            {doc.links.length === 0 ? (
              <p className="channel-side-empty">{t('channel.emptyLinks')}</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;
                const links = docRef.current.links;
                const from = links.findIndex((item) => item.id === active.id);
                const to = links.findIndex((item) => item.id === over.id);
                if (from >= 0 && to >= 0) applyDoc({ ...docRef.current, links: arrayMove(links, from, to) });
              }}>
              <SortableContext items={doc.links.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <ul className="channel-link-list">
                {doc.links.map((item) => (
                  <SortableLink key={item.id} id={item.id} label={t('channel.reorderLink')} onMenu={(x, y) => setLinkMenu({ id: item.id, x, y })}>
                    <div className="channel-link-main">
                      {isExternalHref(item.url) ? (
                        <a
                          href={item.url}
                          className="channel-chat-inline-link"
                          onClick={(e) => {
                            e.preventDefault();
                            void openExternalLink(item.url);
                          }}
                        >
                          {item.title || item.url}
                        </a>
                      ) : (
                        <span>{item.title || item.url}</span>
                      )}
                      {item.title && item.url !== item.title && (
                        <span className="channel-link-url">{item.url}</span>
                      )}
                      {item.note && <p className="channel-link-note">{item.note}</p>}
                      <time dateTime={item.createdAt}>{formatSentAt(item.createdAt)}</time>
                    </div>
                    <button type="button" className="channel-row-delete channel-link-menu-button" aria-label={t('channel.linkActions')} title={t('channel.linkActions')} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setLinkMenu({ id: item.id, x: rect.left, y: rect.bottom }); }}><MoreHorizontal size={16} /></button>
                    <button type="button" className="channel-row-delete" onClick={() => deleteLink(item.id)}>
                      <Trash2 size={13} />
                    </button>
                  </SortableLink>
                ))}
              </ul>
              </SortableContext>
              </DndContext>
            )}
          </div>
        )}

        {bulkLinksOpen && activeTab === 'links' && (
          <div className="modal-overlay" onClick={() => setBulkLinksOpen(false)}>
            <div className="modal channel-link-import-modal" role="dialog" aria-modal="true" aria-label={t('channel.bulkImportLinks')} onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">{t('channel.bulkImportLinks')}</h2>
              <p className="modal-message">{t('channel.bulkImportHint')}</p>
              <textarea autoFocus value={bulkLinksText} onChange={(e) => setBulkLinksText(e.target.value)} placeholder={t('channel.bulkImportPlaceholder')} />
              <div className="channel-link-import-footer">
                <button type="button" className="btn btn-sm" onClick={() => setBulkLinksOpen(false)}>{t('common.cancel')}</button>
                <button type="button" className="btn btn-primary btn-sm" disabled={!bulkLinksText.trim()} onClick={() => importLinks(bulkLinksText)}>{t('channel.startImport')}</button>
              </div>
            </div>
          </div>
        )}

        {editingLinkId && activeTab === 'links' && (
          <div className="modal-overlay" onClick={() => setEditingLinkId(null)}>
            <div className="modal channel-link-edit-modal" role="dialog" aria-modal="true" aria-label={t('channel.editLink')} onClick={(event) => event.stopPropagation()}>
              <h2 className="modal-title">{t('channel.editLink')}</h2>
              <input autoFocus value={editingLinkDraft.url} onChange={(event) => setEditingLinkDraft((draft) => ({ ...draft, url: event.target.value }))} placeholder={t('channel.linkUrl')} />
              <input value={editingLinkDraft.title} onChange={(event) => setEditingLinkDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder={t('channel.linkTitle')} />
              <textarea value={editingLinkDraft.note} onChange={(event) => setEditingLinkDraft((draft) => ({ ...draft, note: event.target.value }))} placeholder={t('channel.linkNote')} />
              <div className="channel-link-import-footer"><button type="button" className="btn btn-sm" onClick={() => setEditingLinkId(null)}>{t('common.cancel')}</button><button type="button" className="btn btn-primary btn-sm" disabled={!editingLinkDraft.url.trim()} onClick={saveEditedLink}>{t('channel.saveLink')}</button></div>
            </div>
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="channel-side-panel">
            <div className="channel-side-form channel-side-form-grid">
              <input
                value={resourceDraft.name}
                onChange={(e) => setResourceDraft((s) => ({ ...s, name: e.target.value }))}
                placeholder={t('channel.resourceName')}
              />
              <input
                value={resourceDraft.kind}
                onChange={(e) => setResourceDraft((s) => ({ ...s, kind: e.target.value }))}
                placeholder={t('channel.resourceKind')}
              />
              <input
                value={resourceDraft.uri}
                onChange={(e) => setResourceDraft((s) => ({ ...s, uri: e.target.value }))}
                placeholder={t('channel.resourceUri')}
              />
              <input
                value={resourceDraft.note}
                onChange={(e) => setResourceDraft((s) => ({ ...s, note: e.target.value }))}
                placeholder={t('channel.resourceNote')}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={addResource}>
                {t('channel.addResource')}
              </button>
            </div>
            {doc.resources.length === 0 ? (
              <p className="channel-side-empty">{t('channel.emptyResources')}</p>
            ) : (
              <ul className="channel-resource-list">
                {doc.resources.map((item) => (
                  <li key={item.id}>
                    <div className="channel-resource-main">
                      <strong>{item.name}</strong>
                      {item.kind && <span className="channel-resource-kind">{item.kind}</span>}
                      {item.uri && (
                        isExternalHref(item.uri) ? (
                          <a
                            href={item.uri}
                            className="channel-chat-inline-link"
                            onClick={(e) => {
                              e.preventDefault();
                              void openExternalLink(item.uri);
                            }}
                          >
                            {item.uri}
                          </a>
                        ) : (
                          <code>{item.uri}</code>
                        )
                      )}
                      {item.note && <p>{item.note}</p>}
                      <time dateTime={item.createdAt}>{formatSentAt(item.createdAt)}</time>
                    </div>
                    <button type="button" className="channel-row-delete" onClick={() => deleteResource(item.id)}>
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="channel-side-panel">
            <div className="channel-settings-form">
              <label className="channel-settings-field">
                <span>{t('channel.settings.title')}</span>
                <input
                  value={doc.title}
                  onChange={(e) => applyDoc({ ...docRef.current, title: e.target.value })}
                  placeholder={currentNotebook.name}
                  aria-label={t('channel.settings.title')}
                />
              </label>
              <label className="channel-settings-field">
                <span>{t('channel.settings.subtitle')}</span>
                <input
                  value={doc.subtitle}
                  onChange={(e) => applyDoc({ ...docRef.current, subtitle: e.target.value })}
                  placeholder={t('channel.settings.subtitlePlaceholder')}
                  aria-label={t('channel.settings.subtitle')}
                />
              </label>
              {(['showTime', 'showMemberAvatars'] as const).map((key) => (
                <label key={key} className="channel-display-option">
                  <input type="checkbox" checked={doc[key] !== false} onChange={(event) => applyDoc({ ...docRef.current, [key]: event.target.checked })} />
                  <span>{t(`channel.${key}`)}</span>
                </label>
              ))}
              <fieldset className="channel-feature-list">
                <legend>{t('channel.settings.features')}</legend>
                {TAB_DEFS.map(({ id, labelKey }) => (
                  <label key={id} className="channel-display-option">
                    <input type="checkbox" checked={enabledTabs.includes(id)} disabled={REQUIRED_CHANNEL_TABS.includes(id)} onChange={(event) => applyDoc({ ...docRef.current, enabledTabs: normalizeEnabledTabs(event.target.checked ? [...enabledTabs, id] : enabledTabs.filter((tab) => tab !== id)) })} />
                    <span>{t(labelKey)}</span>
                  </label>
                ))}
                <small>{t('channel.settings.requiredFeaturesHint')}</small>
              </fieldset>
              <p className="channel-settings-hint">{t('channel.settings.hint')}</p>
            </div>
          </div>
        )}
      </div>
      {remarkMenu && (
        <ContextMenuPortal x={remarkMenu.x} y={remarkMenu.y} onClose={() => setRemarkMenu(null)}>
          <button type="button" className="context-menu-item danger" autoFocus onClick={() => {
            const message = docRef.current.messages.find((item) => item.id === remarkMenu.messageId);
            if (message) {
              updateMessage(message.id, { remarks: (message.remarks ?? []).filter((remark) => remark.id !== remarkMenu.remarkId) });
            }
            setRemarkMenu(null);
          }}>
            <Trash2 size={14} />
            {t('channel.deleteRemark')}
          </button>
        </ContextMenuPortal>
      )}
      {messageMenu && (
        <ContextMenuPortal x={messageMenu.x} y={messageMenu.y} onClose={() => setMessageMenu(null)}>
          <button type="button" className="context-menu-item" autoFocus onClick={() => void copyMessage(messageMenu.id)}>
            <Copy size={14} />{t('channel.copyMessage')}
          </button>
          <button type="button" className="context-menu-item" onClick={() => {
            setRemarkTargetId(messageMenu.id);
            setRemarkDraft('');
            setMessageMenu(null);
          }}>
            <StickyNote size={14} />{t('channel.addRemark')}
          </button>
          <button type="button" className="context-menu-item" onClick={() => addMessageTodo(messageMenu.id)}>
            <Check size={14} />{t('channel.addAsTodo')}
          </button>
          <button type="button" className="context-menu-item danger" onClick={() => {
            deleteMessage(messageMenu.id);
            setMessageMenu(null);
          }}>
            <Trash2 size={14} />
            {t('channel.deleteMessage')}
          </button>
        </ContextMenuPortal>
      )}
      {linkMenu && (() => {
        const item = doc.links.find((link) => link.id === linkMenu.id);
        if (!item) return null;
        return <ContextMenuPortal x={linkMenu.x} y={linkMenu.y} onClose={() => setLinkMenu(null)}>
          <button type="button" className="context-menu-item" onClick={() => startEditingLink(item)}><Pencil size={14} />{t('channel.editLink')}</button>
          <button type="button" className="context-menu-item" onClick={() => void copyLinkText(markdownLink(item))}><Copy size={14} />{t('channel.copyMarkdownLink')}</button>
          <button type="button" className="context-menu-item" onClick={() => void copyLinkText(`${item.title || item.url} | ${item.url}`)}><Copy size={14} />{t('channel.copyTitlePipeLink')}</button>
          <button type="button" className="context-menu-item" onClick={() => void copyLinkText(`${item.title || item.url} - ${item.url}`)}><Copy size={14} />{t('channel.copyTitleDashLink')}</button>
          <button type="button" className="context-menu-item danger" onClick={() => { deleteLink(item.id); setLinkMenu(null); }}><Trash2 size={14} />{t('channel.deleteLink')}</button>
        </ContextMenuPortal>;
      })()}
    </div>
  );
};

export default ChannelNotebookPanel;
