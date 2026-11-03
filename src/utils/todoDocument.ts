import { createChannelId, type ChannelTodoGroup, type ChannelTodoItem } from './channelDocument.ts';

export interface TodoDocument {
  version: 1;
  todos: ChannelTodoItem[];
  todoGroups: ChannelTodoGroup[];
  todoView: 'list' | 'board';
}

export function createEmptyTodoDocument(): TodoDocument {
  return { version: 1, todos: [], todoGroups: [], todoView: 'list' };
}

export function parseTodoDocument(raw: string): TodoDocument {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return createEmptyTodoDocument();
    const data = value as Record<string, unknown>;
    const todos = Array.isArray(data.todos) ? data.todos.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
      .filter((item) => typeof item.text === 'string')
      .map((item) => ({ ...item, id: typeof item.id === 'string' ? item.id : createChannelId(), text: String(item.text), done: item.done === true, createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString() } as ChannelTodoItem)) : [];
    const todoGroups = Array.isArray(data.todoGroups) ? data.todoGroups.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
      .filter((item) => typeof item.name === 'string' && item.name.trim())
      .map((item) => ({ id: typeof item.id === 'string' ? item.id : createChannelId(), name: String(item.name), collapsed: item.collapsed === true })) : [];
    return { version: 1, todos, todoGroups, todoView: data.todoView === 'board' ? 'board' : 'list' };
  } catch { return createEmptyTodoDocument(); }
}

export function serializeTodoDocument(doc: TodoDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
