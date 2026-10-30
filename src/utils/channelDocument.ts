export const CHANNEL_DOCUMENT_VERSION = 1 as const;

/** Stable id for the default “myself” member in new and migrated documents. */
export const DEFAULT_SELF_MEMBER_ID = 'self';

export type ChannelTabId = 'chat' | 'todos' | 'links' | 'resources' | 'members' | 'settings';

export interface ChannelMember {
  id: string;
  name: string;
  /** Exactly one member should be marked as self (the local user). */
  isSelf?: boolean;
}

export interface ChannelMessage {
  id: string;
  /** Fixed label kept for extensibility; UI defaults to “message”. */
  type: string;
  content: string;
  sentAt: string;
  authorId: string;
}

export interface ChannelTodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

export interface ChannelLinkItem {
  id: string;
  url: string;
  title: string;
  note: string;
  createdAt: string;
}

export interface ChannelResourceItem {
  id: string;
  name: string;
  kind: string;
  uri: string;
  note: string;
  createdAt: string;
}

export interface ChannelDocument {
  version: typeof CHANNEL_DOCUMENT_VERSION;
  title: string;
  subtitle: string;
  showTime?: boolean;
  showMemberAvatars?: boolean;
  members: ChannelMember[];
  messages: ChannelMessage[];
  todos: ChannelTodoItem[];
  links: ChannelLinkItem[];
  resources: ChannelResourceItem[];
}

export function createChannelId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDefaultMembers(selfDisplayName: string): ChannelMember[] {
  return [{ id: DEFAULT_SELF_MEMBER_ID, name: selfDisplayName, isSelf: true }];
}

export function createEmptyChannelDocument(selfMemberName: string, title = ''): ChannelDocument {
  return {
    version: CHANNEL_DOCUMENT_VERSION,
    title,
    subtitle: '',
    showTime: true,
    showMemberAvatars: true,
    members: createDefaultMembers(selfMemberName),
    messages: [],
    todos: [],
    links: [],
    resources: [],
  };
}

export function createInitialChannelContent(selfMemberName: string, title = ''): string {
  return serializeChannelDocument(createEmptyChannelDocument(selfMemberName, title));
}

export function getSelfMember(members: ChannelMember[]): ChannelMember | undefined {
  return members.find((member) => member.isSelf) ?? members[0];
}

export function getSelfMemberId(members: ChannelMember[]): string {
  return getSelfMember(members)?.id ?? DEFAULT_SELF_MEMBER_ID;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeMember(raw: unknown): ChannelMember | null {
  if (!isRecord(raw)) return null;
  const name = readString(raw.name);
  if (!name) return null;
  return {
    id: readString(raw.id) || createChannelId(),
    name,
    isSelf: readBool(raw.isSelf),
  };
}

function normalizeMessage(
  raw: unknown,
  index: number,
  fallbackAuthorId: string,
): ChannelMessage | null {
  if (!isRecord(raw)) return null;
  const content = readString(raw.content);
  const sentAt = readString(raw.sentAt) || new Date().toISOString();
  const id = readString(raw.id) || createChannelId();
  const type = readString(raw.type, 'message');
  if (!content && !readString(raw.type)) return null;
  return {
    id,
    type,
    content,
    sentAt: sentAt || new Date(Date.now() - index).toISOString(),
    authorId: readString(raw.authorId) || fallbackAuthorId,
  };
}

function normalizeTodo(raw: unknown): ChannelTodoItem | null {
  if (!isRecord(raw)) return null;
  const text = readString(raw.text);
  if (!text) return null;
  return {
    id: readString(raw.id) || createChannelId(),
    text,
    done: readBool(raw.done),
    createdAt: readString(raw.createdAt) || new Date().toISOString(),
  };
}

function normalizeLink(raw: unknown): ChannelLinkItem | null {
  if (!isRecord(raw)) return null;
  const url = readString(raw.url);
  if (!url) return null;
  return {
    id: readString(raw.id) || createChannelId(),
    url,
    title: readString(raw.title),
    note: readString(raw.note),
    createdAt: readString(raw.createdAt) || new Date().toISOString(),
  };
}

function normalizeResource(raw: unknown): ChannelResourceItem | null {
  if (!isRecord(raw)) return null;
  const name = readString(raw.name);
  if (!name) return null;
  return {
    id: readString(raw.id) || createChannelId(),
    name,
    kind: readString(raw.kind),
    uri: readString(raw.uri),
    note: readString(raw.note),
    createdAt: readString(raw.createdAt) || new Date().toISOString(),
  };
}

function ensureMembers(
  members: ChannelMember[],
  selfMemberNameFallback: string,
): ChannelMember[] {
  if (members.length === 0) {
    return createDefaultMembers(selfMemberNameFallback);
  }
  const hasSelf = members.some((member) => member.isSelf);
  if (hasSelf) return members;
  return members.map((member, index) => (
    index === 0 ? { ...member, isSelf: true } : member
  ));
}

export function parseChannelDocument(raw: string, selfMemberNameFallback = 'Me'): ChannelDocument {
  const trimmed = raw.trim();
  if (!trimmed) return createEmptyChannelDocument(selfMemberNameFallback);

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) return createEmptyChannelDocument(selfMemberNameFallback);

    const rawMembers = Array.isArray(parsed.members)
      ? parsed.members.map(normalizeMember).filter((item): item is ChannelMember => item != null)
      : [];

    const members = ensureMembers(rawMembers, selfMemberNameFallback);
    const fallbackAuthorId = getSelfMemberId(members);

    const messages = Array.isArray(parsed.messages)
      ? parsed.messages
        .map((item, index) => normalizeMessage(item, index, fallbackAuthorId))
        .filter((item): item is ChannelMessage => item != null)
      : [];

    const todos = Array.isArray(parsed.todos)
      ? parsed.todos.map(normalizeTodo).filter((item): item is ChannelTodoItem => item != null)
      : [];

    const links = Array.isArray(parsed.links)
      ? parsed.links.map(normalizeLink).filter((item): item is ChannelLinkItem => item != null)
      : [];

    const resources = Array.isArray(parsed.resources)
      ? parsed.resources.map(normalizeResource).filter((item): item is ChannelResourceItem => item != null)
      : [];

    return {
      version: CHANNEL_DOCUMENT_VERSION,
      title: readString(parsed.title),
      subtitle: readString(parsed.subtitle),
      showTime: readBool(parsed.showTime, true),
      showMemberAvatars: readBool(parsed.showMemberAvatars, true),
      members,
      messages,
      todos,
      links,
      resources,
    };
  } catch {
    return createEmptyChannelDocument(selfMemberNameFallback);
  }
}

export function serializeChannelDocument(doc: ChannelDocument): string {
  const payload: ChannelDocument = {
    version: CHANNEL_DOCUMENT_VERSION,
    title: doc.title,
    subtitle: doc.subtitle,
    showTime: doc.showTime ?? true,
    showMemberAvatars: doc.showMemberAvatars ?? true,
    members: doc.members,
    messages: doc.messages,
    todos: doc.todos,
    links: doc.links,
    resources: doc.resources,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function createChannelMessage(
  content: string,
  authorId: string,
  type = 'message',
): ChannelMessage {
  return {
    id: createChannelId(),
    type,
    content,
    sentAt: new Date().toISOString(),
    authorId,
  };
}
