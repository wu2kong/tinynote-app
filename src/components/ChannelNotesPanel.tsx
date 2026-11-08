import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/useI18n';
import { createChannelId, type ChannelNoteItem } from '@/utils/channelDocument';

interface Props {
  notes: ChannelNoteItem[];
  showPreview: boolean;
  onChange: (notes: ChannelNoteItem[]) => void;
}

function SortableNote({ note, selected, showPreview, onSelect, onDelete }: {
  note: ChannelNoteItem;
  selected: boolean;
  showPreview: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });
  return <li ref={setNodeRef} className={`channel-note-row${selected ? ' selected' : ''}`}
    style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition, opacity: isDragging ? 0.5 : 1 }}>
    <button type="button" className="channel-note-drag" {...attributes} {...listeners} aria-label={t('channel.notes.reorder')} title={t('channel.notes.reorder')}><GripVertical size={15} /></button>
    <button type="button" className="channel-note-select" onClick={onSelect} aria-current={selected ? 'page' : undefined}>
      <strong>{note.title.trim() || t('channel.notes.untitled')}</strong>
      {showPreview && <span>{note.content.trim().split('\n')[0] || t('channel.notes.empty')}</span>}
    </button>
    <button type="button" className="channel-note-delete" onClick={onDelete} aria-label={t('channel.notes.delete')} title={t('channel.notes.delete')}><Trash2 size={14} /></button>
  </li>;
}

export default function ChannelNotesPanel({ notes, showPreview, onChange }: Props) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = notes.find((note) => note.id === selectedId) ?? notes[0];
  const titleInputRef = useRef<HTMLInputElement>(null);
  const pendingFocusIdRef = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (selectedId && !notes.some((note) => note.id === selectedId)) setSelectedId(null);
  }, [notes, selectedId]);

  useLayoutEffect(() => {
    if (selected?.id !== pendingFocusIdRef.current) return;
    pendingFocusIdRef.current = null;
    titleInputRef.current?.focus();
  }, [selected?.id]);

  const addNote = () => {
    const note = { id: createChannelId(), title: '', content: '', createdAt: new Date().toISOString() };
    pendingFocusIdRef.current = note.id;
    onChange([...notes, note]);
    setSelectedId(note.id);
  };
  const updateNote = (patch: Partial<ChannelNoteItem>) => {
    if (!selected) return;
    onChange(notes.map((note) => note.id === selected.id ? { ...note, ...patch } : note));
  };
  const deleteNote = (id: string) => {
    onChange(notes.filter((note) => note.id !== id));
    if (selected?.id === id) setSelectedId(null);
  };

  return <div className="channel-notes-layout">
    <aside className="channel-notes-list-pane" aria-label={t('channel.notes.list')}>
      <div className="channel-notes-list-header"><strong>{t('channel.notes.list')}</strong><button type="button" className="btn btn-sm" onClick={addNote}><Plus size={14} />{t('channel.notes.add')}</button></div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        const from = notes.findIndex((note) => note.id === active.id);
        const to = notes.findIndex((note) => note.id === over.id);
        if (from >= 0 && to >= 0) onChange(arrayMove(notes, from, to));
      }}>
        <SortableContext items={notes.map((note) => note.id)} strategy={verticalListSortingStrategy}>
          <ul className="channel-notes-list">{notes.map((note) => <SortableNote key={note.id} note={note} selected={selected?.id === note.id} showPreview={showPreview} onSelect={() => setSelectedId(note.id)} onDelete={() => deleteNote(note.id)} />)}</ul>
        </SortableContext>
      </DndContext>
      {!notes.length && <p className="channel-notes-empty">{t('channel.notes.emptyList')}</p>}
    </aside>
    <section className="channel-notes-editor" aria-label={t('channel.notes.editor')}>
      {selected ? <>
        <input ref={titleInputRef} aria-label={t('channel.notes.title')} placeholder={t('channel.notes.title')} value={selected.title} onChange={(event) => updateNote({ title: event.target.value })} />
        <textarea aria-label={t('channel.notes.content')} placeholder={t('channel.notes.content')} wrap="soft" value={selected.content} onChange={(event) => updateNote({ content: event.target.value })} />
      </> : <p className="channel-notes-empty">{t('channel.notes.select')}</p>}
    </section>
  </div>;
}
