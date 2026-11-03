import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, closestCenter, pointerWithin, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, GripVertical, Link2, MoreHorizontal, ArrowUp, ArrowDown, Pencil, Plus, Trash2, X, Columns3, List } from 'lucide-react';
import ContextMenuPortal from './ContextMenuPortal';
import { useI18n } from '@/i18n/useI18n';
import { createChannelId, type ChannelTodoGroup, type ChannelTodoItem } from '@/utils/channelDocument';
import { moveTodo, moveTodoGroup, removeTodoGroup, shouldShowTodoGroups, todoGroupId, restoreChecklistDeletion, insertTodoGroup, type ChecklistDeletion } from '@/utils/channelTodos';

interface Props {
  todos: ChannelTodoItem[];
  groups: ChannelTodoGroup[];
  view: 'list' | 'board';
  onViewChange: (view: 'list' | 'board') => void;
  onChange: (todos: ChannelTodoItem[], groups: ChannelTodoGroup[]) => void;
  onOpenSource?: (id: string) => void;
}

function ChecklistInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input) return;
    const resize = () => { input.style.height = '0px'; input.style.height = `${input.scrollHeight}px`; };
    resize();
    let width = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth !== width) { width = input.clientWidth; resize(); }
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [props.value]);
  return <textarea {...props} ref={ref} rows={1} className="checklist-input" />;
}

function TaskRow({ item, autoFocus, onInsertAfter, groups, onMove, onPatch, onDelete, onOpenSource }: {
  autoFocus: boolean;
  onInsertAfter: () => void;
  groups: ChannelTodoGroup[];
  onMove: (groupId: string) => void;
  item: ChannelTodoItem;
  onPatch: (patch: Partial<ChannelTodoItem>) => void;
  onDelete: () => void;
  onOpenSource?: (id: string) => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver, activeIndex, index } = useSortable({ id: `task:${item.id}` });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const rowRef = useRef<HTMLLIElement | null>(null);
  const focusTextRef = useRef(item.text);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);
  const [editing, setEditing] = useState(false);
  return (
    <li ref={(node) => { rowRef.current = node; setNodeRef(node); }} className={`checklist-task${editing ? ' selected' : ''}${item.done ? ' done' : ''}${isOver && !isDragging ? (activeIndex >= 0 && activeIndex < index ? ' drag-over-after' : ' drag-over-before') : ''}`}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setMenu({ x: event.clientX, y: event.clientY }); }}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition, opacity: isDragging ? 0.45 : 1, zIndex: isDragging ? 1 : undefined }}>
      <button type="button" className="checklist-icon checklist-drag" {...attributes} {...listeners} aria-label={t('todo.dragTask')} title={t('todo.dragTask')}><GripVertical size={15} /></button>
      <input type="checkbox" checked={item.done} aria-label={t(item.done ? 'todo.reopen' : 'todo.complete', { title: item.text })} onChange={() => onPatch({ done: !item.done })} />
      <div className="checklist-task-body">
        <ChecklistInput autoFocus={autoFocus} value={item.text} aria-label={t('todo.title')} placeholder={t('common.untitled')}
          onFocus={() => { focusTextRef.current = item.text; setEditing(true); }}
          onChange={(event) => onPatch({ text: event.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === 'Escape') { onPatch({ text: focusTextRef.current }); event.currentTarget.blur(); }
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onInsertAfter(); }
            if (event.key === 'Backspace' && !item.text) {
              event.preventDefault();
              const row = rowRef.current;
              const adjacent = row?.previousElementSibling ?? row?.nextElementSibling;
              const input = adjacent?.querySelector<HTMLTextAreaElement>('textarea');
              onDelete();
              requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(input.value.length, input.value.length); });
            }
          }} />
      </div>
      {item.sourceMessageId && onOpenSource && <button className="checklist-icon" type="button" title={t('todo.source')} aria-label={t('todo.source')} onClick={() => onOpenSource(item.sourceMessageId!)}><Link2 size={14} /></button>}
      <button className="checklist-icon checklist-row-action" type="button" title={t('todo.delete')} aria-label={t('todo.delete')} onClick={onDelete}><Trash2 size={14} /></button>
      {menu && createPortal(<ContextMenuPortal x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
        <button type="button" className="context-menu-item" autoFocus onClick={() => { setMenu(null); requestAnimationFrame(() => rowRef.current?.querySelector('textarea')?.focus()); }}><Pencil size={14} />{t('todo.edit')}</button>
        {groups.length > 0 && <label className="checklist-move-menu">{t('todo.moveTo')}<select aria-label={t('todo.moveTo')} value={todoGroupId(item, groups)} onChange={(event) => { onMove(event.target.value); setMenu(null); }}>
          <option value="">{t('todo.ungrouped')}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select></label>}
        <button type="button" className="context-menu-item danger" onClick={() => { setMenu(null); onDelete(); }}><Trash2 size={14} />{t('todo.delete')}</button>
      </ContextMenuPortal>, document.body)}
    </li>
  );
}

function GroupSection({ id, name, collapsed, count, onToggle, onRename, onDelete, onAdd, onAddGroup, children, plain = false }: {
  id: string; name: string; collapsed: boolean; count: number; plain?: boolean; onAdd: () => void; onAddGroup: (position: 'before' | 'after') => void;
  onToggle: () => void; onRename?: (name: string) => void; onDelete?: () => void; children: ReactNode;
}) {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({ id: `group:${id}` });
  const sortable = useSortable({ id: `group-sort:${id}`, disabled: !id || plain });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  if (plain) return <div className="checklist-plain">{children}</div>;
  return <section ref={sortable.setNodeRef} className={`checklist-group${isOver ? ' drop-target' : ''}`}
    style={{ position: 'relative', transform: sortable.transform ? `translate3d(${sortable.transform.x}px, ${sortable.transform.y}px, 0)` : undefined, transition: sortable.transition, opacity: sortable.isDragging ? 0.5 : 1, zIndex: sortable.isDragging ? 2 : undefined }}>
    <header ref={setNodeRef} className="checklist-group-header" onContextMenu={(event) => {
      if (!onRename && !onDelete) return;
      event.preventDefault(); event.stopPropagation(); setMenu({ x: event.clientX, y: event.clientY });
    }}>
      {id && <button type="button" className="checklist-icon checklist-drag" {...sortable.attributes} {...sortable.listeners} aria-label={t('todo.dragGroup')} title={t('todo.dragGroup')}><GripVertical size={15} /></button>}
      <button className="checklist-group-toggle" type="button" aria-expanded={!collapsed} onClick={onToggle}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        {!renaming && <span>{name}</span>}<small>{count}</small>
      </button>
      <button type="button" className="checklist-icon checklist-group-add" onClick={onAdd} aria-label={t('channel.addTodo')} title={t('channel.addTodo')}><Plus size={15} /></button>
      {id && <button type="button" className="checklist-icon checklist-group-more" aria-label={t('todo.groupMenu')} title={t('todo.groupMenu')} aria-haspopup="menu" aria-expanded={!!menu} onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect(); setMenu({ x: rect.left, y: rect.bottom + 4 });
      }}><MoreHorizontal size={16} /></button>}
      {renaming && <input autoFocus value={draft} aria-label={t('todo.groupName')} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (draft.trim()) onRename?.(draft.trim()); else setDraft(name); setRenaming(false); }} onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') { setDraft(name); setRenaming(false); }
      }} />}
    </header>
    {!collapsed && children}
    {menu && createPortal(<ContextMenuPortal x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
      <button type="button" className="context-menu-item" autoFocus onClick={() => { setMenu(null); setRenaming(true); }}><Pencil size={14} />{t('common.rename')}</button>
      <button type="button" className="context-menu-item" onClick={() => { setMenu(null); onAddGroup('before'); }}><ArrowUp size={14} />{t('todo.addGroupAbove')}</button>
      <button type="button" className="context-menu-item" onClick={() => { setMenu(null); onAddGroup('after'); }}><ArrowDown size={14} />{t('todo.addGroupBelow')}</button>
      <button type="button" className="context-menu-item danger" onClick={() => { setMenu(null); onDelete?.(); }}><Trash2 size={14} />{t('todo.deleteGroup')}</button>
    </ContextMenuPortal>, document.body)}
  </section>;
}

function AddTask({ onAdd, autoFocus = false, onCancel }: { onAdd: (text: string) => void; autoFocus?: boolean; onCancel?: () => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => {
    if (!draft.trim()) return;
    onAdd(draft.trim()); setDraft(''); formRef.current?.querySelector('textarea')?.focus();
  };
  return <form ref={formRef} className={`checklist-add${draft ? ' has-draft' : ''}`} onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <Plus size={17} /><ChecklistInput autoFocus={autoFocus} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('todo.quickPlaceholder')} aria-label={t('todo.title')} onBlur={(event) => {
      if (!draft.trim() && !formRef.current?.contains(event.relatedTarget as Node | null)) onCancel?.();
    }} onKeyDown={(event) => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (event.key === 'Backspace' && !draft && onCancel) { event.preventDefault(); onCancel(); }
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
      if (event.key === 'Escape') { setDraft(''); event.currentTarget.blur(); onCancel?.(); }
    }} />
    {draft.trim() && <button type="submit" className="checklist-small-button">{t('channel.addTodo')}</button>}
  </form>;
}

export default function ChannelTodosPanel({ todos, groups, view, onViewChange, onChange, onOpenSource }: Props) {
  const { t } = useI18n();
  const [newTaskId, setNewTaskId] = useState<string | null>(null);
  const [composerGroup, setComposerGroup] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState<{ name: string; anchor?: string; position: 'before' | 'after' } | null>(null);
  const [ungroupedCollapsed, setUngroupedCollapsed] = useState(false);
  const [deleted, setDeleted] = useState<ChecklistDeletion | null>(null);
  const [dragging, setDragging] = useState<{ text: string; group: boolean } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const showGroups = shouldShowTodoGroups(todos, groups);
  const sections = [{ id: '', name: t('todo.ungrouped'), collapsed: ungroupedCollapsed }, ...groups];
  const addTask = (text: string, groupId = '') => {
    const item: ChannelTodoItem = { id: createChannelId(), text, done: false, createdAt: new Date().toISOString(), ...(groupId ? { groupId } : {}) };
    const index = todos.findIndex((task) => todoGroupId(task, groups) === groupId);
    const next = [...todos]; next.splice(index < 0 ? next.length : index, 0, item);
    onChange(next, groups);
  };
  const renderGroupForm = () => newGroup && (
    <form className="checklist-new-group" onSubmit={(event) => {
      event.preventDefault(); if (!newGroup.name.trim()) return;
      onChange(todos, insertTodoGroup(groups, { id: createChannelId(), name: newGroup.name.trim(), collapsed: false }, newGroup.anchor, newGroup.position)); setNewGroup(null);
    }}><input autoFocus value={newGroup.name} placeholder={t('todo.groupName')} aria-label={t('todo.groupName')} onChange={(event) => setNewGroup({ ...newGroup, name: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); if (event.key === 'Escape' && !event.nativeEvent.isComposing) setNewGroup(null); }} /><button className="btn btn-sm" disabled={!newGroup.name.trim()}>{t('common.create')}</button><button className="checklist-icon" type="button" aria-label={t('common.cancel')} onClick={() => setNewGroup(null)}><X size={14} /></button></form>
  );
  return <div className="checklist-layout"><div className="checklist">
    <header className="checklist-header"><h2>{t('channel.tabs.todos')}</h2><div className="checklist-header-actions"><div className="checklist-view-switch" role="group" aria-label={t('todo.view')}><button type="button" className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} onClick={() => onViewChange('list')} title={t('todo.listView')}><List size={15} />{t('todo.listView')}</button><button type="button" className={view === 'board' ? 'active' : ''} aria-pressed={view === 'board'} onClick={() => onViewChange('board')} title={t('todo.boardView')}><Columns3 size={15} />{t('todo.boardView')}</button></div><button className="btn btn-sm" type="button" onClick={() => setNewGroup({ name: '', position: 'after' })}><Plus size={14} />{t('todo.addGroup')}</button></div></header>
    <div className="checklist-top-entry"><AddTask onAdd={(text) => addTask(text)} /></div>
    {newGroup && !newGroup.anchor && renderGroupForm()}
    {deleted && <div className="checklist-undo" role="status">{t(deleted.group ? 'todo.groupDeleted' : 'todo.deleted', { count: deleted.tasks.length })}<button type="button" onClick={() => {
      const restored = restoreChecklistDeletion(todos, groups, deleted);
      onChange(restored.todos, restored.groups); setDeleted(null);
    }}>{t('todo.undo')}</button><button type="button" aria-label={t('common.close')} onClick={() => setDeleted(null)}><X size={13} /></button></div>}
    <div className={`checklist-scroll${view === 'board' ? ' checklist-board' : ''}`}>
    <DndContext sensors={sensors} onDragStart={({ active }) => {
      const key = String(active.id);
      const isGroup = key.startsWith('group-sort:');
      const text = isGroup ? groups.find((group) => group.id === key.slice(11))?.name : todos.find((item) => item.id === key.slice(5))?.text;
      setDragging(text ? { text, group: isGroup } : null);
    }} onDragCancel={() => setDragging(null)} collisionDetection={(args) => {
      const draggingGroup = String(args.active.id).startsWith('group-sort:');
      const candidates = { ...args, droppableContainers: args.droppableContainers.filter((item) =>
        draggingGroup ? String(item.id).startsWith('group-sort:') && item.id !== 'group-sort:' : !String(item.id).startsWith('group-sort:')) };
      const pointerHits = pointerWithin(candidates);
      return pointerHits.length ? pointerHits : closestCenter(candidates);
    }} onDragEnd={({ active, over }) => {
      setDragging(null);
      if (!over || active.id === over.id) return;
      if (String(active.id).startsWith('group-sort:')) {
        onChange(todos, moveTodoGroup(groups, String(active.id).slice(11), String(over.id).slice(11)));
        return;
      }
      const id = String(active.id).slice(5);
      const overKey = String(over.id);
      const target = overKey.startsWith('task:') ? todos.find((item) => item.id === overKey.slice(5)) : undefined;
      const groupId = target ? todoGroupId(target, groups) : overKey.slice(6);
      if (!target && groupId && !groups.some((group) => group.id === groupId)) return;
      onChange(moveTodo(todos, id, groupId, target?.id), groups);
    }}>
      <SortableContext items={groups.map((group) => `group-sort:${group.id}`)} strategy={view === 'board' ? horizontalListSortingStrategy : verticalListSortingStrategy}>
      {sections.map((group) => {
        const items = todos.filter((item) => todoGroupId(item, groups) === group.id);
        return <Fragment key={group.id}>
          {newGroup?.anchor === group.id && newGroup.position === 'before' && renderGroupForm()}
          <GroupSection {...group} count={items.length} plain={view === 'list' && !showGroups}
          onAddGroup={(position) => setNewGroup({ name: '', anchor: group.id, position })}
          onAdd={() => {
            setComposerGroup(group.id);
            if (group.collapsed) {
              if (group.id) onChange(todos, groups.map((item) => item.id === group.id ? { ...item, collapsed: false } : item));
              else setUngroupedCollapsed(false);
            }
          }}
          onToggle={() => group.id ? onChange(todos, groups.map((item) => item.id === group.id ? { ...item, collapsed: !item.collapsed } : item)) : setUngroupedCollapsed(!ungroupedCollapsed)}
          onRename={group.id ? (name) => onChange(todos, groups.map((item) => item.id === group.id ? { ...item, name } : item)) : undefined}
          onDelete={group.id ? () => {
            setDeleted({ tasks: todos.flatMap((item, index) => item.groupId === group.id ? [{ item, index }] : []), group: { item: group, index: groups.findIndex((item) => item.id === group.id) } });
            onChange(removeTodoGroup(todos, group.id), groups.filter((item) => item.id !== group.id)); setUngroupedCollapsed(false);
          } : undefined}>
          {composerGroup === group.id && <AddTask autoFocus onCancel={() => setComposerGroup(null)} onAdd={(text) => addTask(text, group.id)} />}
          <SortableContext items={items.map((item) => `task:${item.id}`)} strategy={verticalListSortingStrategy}>
            <ul className="checklist-items">{items.map((item) => <TaskRow key={item.id} item={item} autoFocus={newTaskId === item.id} groups={groups}
              onInsertAfter={() => {
                const newTask: ChannelTodoItem = { id: createChannelId(), text: '', done: false, createdAt: new Date().toISOString(), ...(item.groupId ? { groupId: item.groupId } : {}) };
                const next = [...todos];
                next.splice(next.findIndex((task) => task.id === item.id) + 1, 0, newTask);
                setNewTaskId(newTask.id);
                onChange(next, groups);
              }}
              onMove={(groupId) => onChange(moveTodo(todos, item.id, groupId), groups)}
              onPatch={(patch) => onChange(todos.map((task) => task.id === item.id ? { ...task, ...patch } : task), groups)}
              onDelete={() => { setDeleted({ tasks: [{ item, index: todos.findIndex((task) => task.id === item.id) }] }); onChange(todos.filter((task) => task.id !== item.id), groups); }} onOpenSource={onOpenSource} />)}</ul>
          </SortableContext>
        </GroupSection>
        {newGroup?.anchor === group.id && newGroup.position === 'after' && renderGroupForm()}
        </Fragment>;
      })}
      </SortableContext>
      {createPortal(<DragOverlay dropAnimation={null}>{dragging && <div className="checklist-drag-preview"><GripVertical size={16} />{dragging.group ? <ChevronDown size={15} /> : <span className="checklist-preview-checkbox" />}<span>{dragging.text}</span></div>}</DragOverlay>, document.body)}
    </DndContext>
    </div>
  </div>
  </div>;
}
