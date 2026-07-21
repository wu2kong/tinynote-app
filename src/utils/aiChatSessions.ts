import { getStorageAdapter } from '@/adapters/storage';
import { getBoundWorkspacePath } from '@/utils/config';
import { joinPath, normalizePath } from '@/utils/path';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  /** 运行期字段：对应的磁盘文件路径，不序列化到 frontmatter。 */
  filePath?: string;
}

const CHAT_SESSIONS_DIR = '.tinynotes/ai-chats';
const MESSAGE_MARKER_RE = /^<!-- message (\{.*\}) -->$/;

function getChatSessionsDir(): string | null {
  const workspace = getBoundWorkspacePath();
  if (!workspace) return null;
  return joinPath(normalizePath(workspace), CHAT_SESSIONS_DIR);
}

/** 生成 `YYYYMMDD-HHmmss`（本地时区），用于会话文件名。 */
export function formatSessionFileTimestamp(ts: number): string {
  const date = new Date(ts);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function slugifySessionTitle(title: string): string {
  const slug = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 40)
    .trim();
  return slug || 'chat';
}

function getSessionFileName(session: ChatSession): string {
  return `${formatSessionFileTimestamp(session.createdAt)}-${slugifySessionTitle(session.title)}.md`;
}

function serializeSession(session: ChatSession): string {
  const lines: string[] = [
    '---',
    `id: ${JSON.stringify(session.id)}`,
    `title: ${JSON.stringify(session.title)}`,
    `createdAt: ${JSON.stringify(session.createdAt)}`,
    `updatedAt: ${JSON.stringify(session.updatedAt)}`,
    '---',
    '',
  ];
  for (const message of session.messages) {
    lines.push(`<!-- message ${JSON.stringify({ role: message.role, id: message.id })} -->`, '', message.content, '');
  }
  return lines.join('\n');
}

function parseFrontmatterValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function parseMessageMarker(line: string): { role: ChatRole; id: string } | null {
  const match = MESSAGE_MARKER_RE.exec(line);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]) as { role?: unknown; id?: unknown };
    if ((data.role === 'user' || data.role === 'assistant') && typeof data.id === 'string' && data.id) {
      return { role: data.role, id: data.id };
    }
  } catch {
    // 正文中恰好形似标记的行按正文处理，保证回读健壮。
  }
  return null;
}

function parseSessionFile(content: string): ChatSession | null {
  const text = content.replace(/\r\n/g, '\n');
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!frontmatterMatch) return null;

  const fields: Record<string, unknown> = {};
  for (const line of frontmatterMatch[1].split('\n')) {
    const separator = line.indexOf(': ');
    if (separator <= 0) continue;
    fields[line.slice(0, separator)] = parseFrontmatterValue(line.slice(separator + 2));
  }

  const messages: ChatMessage[] = [];
  let current: { role: ChatRole; id: string } | null = null;
  let buffer: string[] = [];
  let skipLeadingBlank = false;
  const flush = () => {
    if (!current) return;
    messages.push({ id: current.id, role: current.role, content: buffer.join('\n').replace(/\n+$/, '') });
    buffer = [];
  };
  for (const line of text.slice(frontmatterMatch[0].length).split('\n')) {
    const marker = parseMessageMarker(line);
    if (marker) {
      flush();
      current = marker;
      skipLeadingBlank = true;
      continue;
    }
    if (!current) continue;
    if (skipLeadingBlank) {
      skipLeadingBlank = false;
      if (line === '') continue; // 标记与正文之间恰好一个空行
    }
    buffer.push(line);
  }
  flush();

  const now = Date.now();
  return {
    id: typeof fields.id === 'string' && fields.id ? fields.id : globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random()}`,
    title: typeof fields.title === 'string' && fields.title ? fields.title : '未命名会话',
    createdAt: typeof fields.createdAt === 'number' ? fields.createdAt : now,
    updatedAt: typeof fields.updatedAt === 'number' ? fields.updatedAt : now,
    messages,
  };
}

/** 读取工作区下全部会话文件，按 updatedAt 降序返回；无工作区时静默返回空。 */
export async function listChatSessions(): Promise<ChatSession[]> {
  const dir = getChatSessionsDir();
  if (!dir) return [];
  const storage = getStorageAdapter();
  try {
    if (!(await storage.exists(dir))) return [];
    const entries = await storage.readDir(dir);
    const sessions: ChatSession[] = [];
    for (const entry of entries) {
      if (!entry.isFile || !entry.name.endsWith('.md')) continue;
      const filePath = joinPath(dir, entry.name);
      try {
        const session = parseSessionFile(await storage.readTextFile(filePath));
        if (!session) throw new Error('会话文件缺少 frontmatter');
        sessions.push({ ...session, filePath });
      } catch (error) {
        console.warn('[ai-chat] 会话文件解析失败，已跳过:', filePath, error);
      }
    }
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.warn('[ai-chat] 读取会话目录失败:', error);
    return [];
  }
}

/** 保存会话，返回实际写入的 filePath；无工作区时返回 null。 */
export async function saveChatSession(session: ChatSession): Promise<string | null> {
  const dir = getChatSessionsDir();
  if (!dir) return null;
  const storage = getStorageAdapter();
  await storage.mkdir(dir, true);
  const filePath = joinPath(dir, getSessionFileName(session));
  await storage.writeTextFile(filePath, serializeSession(session));
  const previousPath = session.filePath;
  if (previousPath && normalizePath(previousPath) !== normalizePath(filePath)) {
    try {
      await storage.remove(previousPath);
    } catch (error) {
      console.warn('[ai-chat] 旧会话文件清理失败:', previousPath, error);
    }
  }
  return filePath;
}

/** 删除会话文件，失败静默。 */
export async function deleteChatSession(filePath: string): Promise<void> {
  if (!filePath) return;
  try {
    await getStorageAdapter().remove(filePath);
  } catch (error) {
    console.warn('[ai-chat] 删除会话文件失败:', filePath, error);
  }
}
