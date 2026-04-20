import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import NoteBlockItem from './NoteBlock';
import { List, LayoutGrid, AlignJustify, Plus, Search, ClipboardPaste } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { parseNoteBlocks } from '@/utils/noteParser';

const NotePanel: React.FC = () => {
  const currentNotebook = useStore((s) => s.currentNotebook);
  const currentNoteBlock = useStore((s) => s.currentNoteBlock);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const setNoteBlock = useStore((s) => s.setNoteBlock);
  const addNoteBlock = useStore((s) => s.addNoteBlock);
  const reorderNoteBlocks = useStore((s) => s.reorderNoteBlocks);
  const pasteNoteBlockAtEnd = useStore((s) => s.pasteNoteBlockAtEnd);

  const [searchText, setSearchText] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [clipboardHasNote, setClipboardHasNote] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const filteredBlocks = useMemo(() => {
    if (!currentNotebook) return [];
    const blocks = currentNotebook.noteBlocks;
    if (!searchText) return blocks;
    const q = searchText.toLowerCase();
    return blocks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.content.toLowerCase().includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [currentNotebook, searchText]);

  const handleDragEnd = (event: import('@dnd-kit/core').DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = currentNotebook!.noteBlocks.findIndex((b) => b.id === active.id);
    const newIndex = currentNotebook!.noteBlocks.findIndex((b) => b.id === over.id);
    reorderNoteBlocks(oldIndex, newIndex);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.note-block-list,.note-block-card,.note-block-compact')) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const checkClipboardForNote = async () => {
    try {
      const text = await readText();
      if (text && text.trim().startsWith('---')) {
        const blocks = parseNoteBlocks(text);
        setClipboardHasNote(blocks.length > 0);
      } else {
        setClipboardHasNote(false);
      }
    } catch {
      setClipboardHasNote(false);
    }
  };

  useEffect(() => {
    if (contextMenu) {
      checkClipboardForNote();
    }
  }, [contextMenu]);

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleAddNoteBlock = () => {
    addNoteBlock();
    closeContextMenu();
  };

  const handlePasteNote = async () => {
    try {
      const text = await readText();
      if (text) {
        const blocks = parseNoteBlocks(text);
        if (blocks.length > 0) {
          pasteNoteBlockAtEnd(blocks[0]);
        }
      }
    } catch (e) {
      console.error('Failed to paste note:', e);
    }
    closeContextMenu();
  };

  if (!currentNotebook) {
    return (
      <div className="note-panel">
        <div className="note-panel-empty">选择笔记本以查看笔记</div>
      </div>
    );
  }

  return (
    <div className="note-panel">
      <div className="note-panel-header">
        <div className="note-panel-view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="列表视图"
          >
            <List size={16} />
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
            onClick={() => setViewMode('card')}
            title="卡片视图"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'compact' ? 'active' : ''}`}
            onClick={() => setViewMode('compact')}
            title="紧凑视图"
          >
            <AlignJustify size={16} />
          </button>
        </div>
        <div className="note-panel-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="搜索笔记..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
      </div>

      <div className={`note-panel-list ${viewMode}`} onContextMenu={handleContextMenu}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredBlocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {filteredBlocks.map((block, idx) => (
              <NoteBlockItem
                key={block.id}
                block={block}
                viewMode={viewMode}
                index={idx}
                isSelected={currentNoteBlock?.id === block.id}
                onSelect={() => setNoteBlock(block)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <button className="note-panel-add" onClick={() => addNoteBlock()}>
        <Plus size={16} />
        添加笔记
      </button>

      {contextMenu && (
        <>
          <div className="context-menu-overlay" onClick={closeContextMenu} />
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button className="context-menu-item" onClick={handleAddNoteBlock}>
              <Plus size={14} />
              添加笔记块
            </button>
            {clipboardHasNote && (
              <button className="context-menu-item" onClick={handlePasteNote}>
                <ClipboardPaste size={14} />
                粘贴笔记
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotePanel;