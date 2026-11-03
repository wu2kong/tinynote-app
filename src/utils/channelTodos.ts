import type { ChannelTodoGroup, ChannelTodoItem } from './channelDocument.ts';

/** Orphaned tasks remain visible in the ungrouped list. */
export function todoGroupId(todo: ChannelTodoItem, groups: ChannelTodoGroup[]): string {
  return groups.some((group) => group.id === todo.groupId) ? todo.groupId! : '';
}

/** Keep explicit order, including completed tasks; only the dragged task moves. */
export function moveTodo(todos: ChannelTodoItem[], id: string, groupId: string, overId?: string): ChannelTodoItem[] {
  const from = todos.findIndex((item) => item.id === id);
  if (from < 0 || id === overId) return todos;
  const target = overId ? todos.findIndex((item) => item.id === overId) : -1;
  if (overId && target < 0) return todos;
  const moving = { ...todos[from], groupId: groupId || undefined };
  const next = todos.filter((item) => item.id !== id);
  if (target < 0) {
    next.push(moving);
  } else {
    const sameGroup = (todos[from].groupId || '') === groupId;
    const index = next.findIndex((item) => item.id === overId);
    next.splice(index + (sameGroup && from < target ? 1 : 0), 0, moving);
  }
  return next;
}

export function removeTodoGroup(todos: ChannelTodoItem[], groupId: string): ChannelTodoItem[] {
  return todos.filter((item) => item.groupId !== groupId);
}

export function shouldShowTodoGroups(todos: ChannelTodoItem[], groups: ChannelTodoGroup[]): boolean {
  return groups.length > 0 || todos.some((item) => !!item.groupId);
}

export function moveTodoGroup(groups: ChannelTodoGroup[], id: string, overId: string): ChannelTodoGroup[] {
  const from = groups.findIndex((group) => group.id === id);
  const to = groups.findIndex((group) => group.id === overId);
  if (from < 0 || to < 0 || from === to) return groups;
  const next = [...groups];
  const [moving] = next.splice(from, 1);
  next.splice(to, 0, moving);
  return next;
}

export interface ChecklistDeletion {
  tasks: { item: ChannelTodoItem; index: number }[];
  group?: { item: ChannelTodoGroup; index: number };
}

export function restoreChecklistDeletion(todos: ChannelTodoItem[], groups: ChannelTodoGroup[], deleted: ChecklistDeletion) {
  const next = [...todos];
  deleted.tasks.forEach(({ item, index }) => {
    if (!next.some((task) => task.id === item.id)) next.splice(Math.min(index, next.length), 0, item);
  });
  const nextGroups = [...groups];
  const group = deleted.group;
  if (group && !nextGroups.some((item) => item.id === group.item.id)) nextGroups.splice(Math.min(group.index, nextGroups.length), 0, group.item);
  return { todos: next, groups: nextGroups };
}

export function insertTodoGroup(groups: ChannelTodoGroup[], group: ChannelTodoGroup, anchor?: string, position: 'before' | 'after' = 'after'): ChannelTodoGroup[] {
  const index = groups.findIndex((item) => item.id === anchor);
  const next = [...groups];
  next.splice(index < 0 ? next.length : index + (position === 'after' ? 1 : 0), 0, group);
  return next;
}
