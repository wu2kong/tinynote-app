import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import NoteBlockItem from './NoteBlock';
import ContextMenuPortal from './ContextMenuPortal';
import { List, LayoutGrid, AlignJustify, Plus, Search, X, ClipboardPaste, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
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
import { ContentType } from '@/types';
import { useI18n } from '@/i18n/useI18n';

const NOTE_TYPES: { contentType: ContentType; labelKey: string }[] = [
  { contentType: 'text', labelKey: 'note.addText' },
  { contentType: 'markdown', labelKey: 'note.addMarkdown' },
  { contentType: 'json', labelKey: 'note.addJson' },
  { contentType: 'ini', labelKey: 'note.addIni' },
  { contentType: 'yaml', labelKey: 'note.addYaml' },
  { contentType: 'xml', labelKey: 'note.addXml' },
  { contentType: 'css', labelKey: 'note.addCss' },
  { contentType: 'bash', labelKey: 'note.addBash' },
  { contentType: 'sql', labelKey: 'note.addSql' },
  { contentType: 'python', labelKey: 'note.addPython' },
  { contentType: 'go', labelKey: 'note.addGo' }
];

const NotePanel: React.FC = () => {
  const { t } = useI18n();
  const currentNotebook = useStore((s) => s.currentNotebook);
  const currentNoteBlock = useStore((s) => s.currentNoteBlock);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const setNoteBlock = useStore((s) => s.setNoteBlock);
  const addNoteBlock = useStore((s) => s.addNoteBlock);
  const reorderNoteBlocks = useStore((s) => s.reorderNoteBlocks);
  const pasteNoteBlockAtEnd = useStore((s) => s.pasteNoteBlockAtEnd);
  const showDirectoryPanel = useStore((s) => s.showDirectoryPanel);
  const showAppBar = useStore((s) => s.showAppBar);
  const toggleDirectoryPanel = useStore((s) => s.toggleDirectoryPanel);

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

  const handleAddNoteBlock = (contentType: ContentType) => {
    addNoteBlock(contentType);
    closeContextMenu();
  };

  const openAddMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setContextMenu({ x: rect.left + rect.width / 2, y: rect.top });
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
        <div className="note-panel-empty">{t('note.selectNotebook')}</div>
      </div>
    );
  }

  const leftPanelVisible = showDirectoryPanel || showAppBar;

  return (
    <div className="note-panel">
      <div className="note-panel-header">
        <button
          className="left-panel-toggle"
          onClick={toggleDirectoryPanel}
          title={leftPanelVisible ? t('app.hideSidebar') : t('app.showSidebar')}
        >
          {leftPanelVisible ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <div className="note-panel-view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title={t('note.listView')}
          >
            <List size={16} />
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
            onClick={() => setViewMode('card')}
            title={t('note.cardView')}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'compact' ? 'active' : ''}`}
            onClick={() => setViewMode('compact')}
            title={t('note.compactView')}
          >
            <AlignJustify size={16} />
          </button>
        </div>
        <div className="note-panel-search">
          <Search size={14} />
          <input
            type="text"
            placeholder={t('note.searchNote')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {searchText && (
            <button
              type="button"
              className="search-clear-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSearchText('')}
              title={t('directory.clearSearch')}
              aria-label={t('directory.clearSearch')}
            >
              <X size={14} />
            </button>
          )}
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

      <button className="note-panel-add" onClick={openAddMenu}>
        <Plus size={16} />
        {t('note.addNote')}
      </button>

      {contextMenu && (
        <ContextMenuPortal x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu}>
          {NOTE_TYPES.map(({ contentType, labelKey }) => (
            <button key={contentType} className="context-menu-item" onClick={() => handleAddNoteBlock(contentType)}>
              <Plus size={14} />
              {t(labelKey)}
            </button>
          ))}
            {clipboardHasNote && (
              <button className="context-menu-item" onClick={handlePasteNote}>
                <ClipboardPaste size={14} />
                {t('note.pasteNote')}
              </button>
            )}
        </ContextMenuPortal>
      )}
    </div>
  );
};

export default NotePanel;
