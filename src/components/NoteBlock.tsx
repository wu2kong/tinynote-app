import React, { useState } from 'react';
import { NoteBlock as NoteBlockType, ViewMode } from '@/types';
import { Copy, Check, GripVertical, Plus, Trash2, CopyPlus } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useStore } from '@/store/useStore';

interface NoteBlockProps {
  block: NoteBlockType;
  viewMode: ViewMode;
  isSelected: boolean;
  index: number;
  onSelect: () => void;
}

const NoteBlockItem: React.FC<NoteBlockProps> = ({ block, viewMode, isSelected, index, onSelect }) => {
  const [copied, setCopied] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });

  const addNoteBlockAtIndex = useStore((s) => s.addNoteBlockAtIndex);
  const duplicateNoteBlock = useStore((s) => s.duplicateNoteBlock);
  const deleteNoteBlock = useStore((s) => s.deleteNoteBlock);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const copyToClipboard = async (text: string) => {
    try {
      await writeText(text);
      return true;
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(block.content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleAddAbove = () => {
    addNoteBlockAtIndex(index);
    closeContextMenu();
  };

  const handleAddBelow = () => {
    addNoteBlockAtIndex(index + 1);
    closeContextMenu();
  };

  const handleDuplicate = () => {
    duplicateNoteBlock(block.id, index + 1);
    closeContextMenu();
  };

  const handleDelete = () => {
    deleteNoteBlock(block.id);
    closeContextMenu();
  };

  const handleCopyContent = async () => {
    await copyToClipboard(block.content);
    closeContextMenu();
  };

  const handleCopyTitleAndContent = async () => {
    const text = block.title ? `${block.title}\n\n${block.content}` : block.content;
    await copyToClipboard(text);
    closeContextMenu();
  };

  const contentPreview = block.content.length > 100 ? block.content.slice(0, 100) + '...' : block.content;
  const lines = block.content.split('\n').length;

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    return (
      <>
        <div className="context-menu-overlay" onClick={closeContextMenu} />
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button className="context-menu-item" onClick={handleAddAbove}>
            <Plus size={14} />
            在上方增加笔记块
          </button>
          <button className="context-menu-item" onClick={handleAddBelow}>
            <Plus size={14} />
            在下方增加笔记块
          </button>
          <button className="context-menu-item" onClick={handleDuplicate}>
            <CopyPlus size={14} />
            在下方创建副本
          </button>
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={handleCopyContent}>
            <Copy size={14} />
            复制正文
          </button>
          <button className="context-menu-item" onClick={handleCopyTitleAndContent}>
            <Copy size={14} />
            复制标题和正文
          </button>
          <div className="context-menu-divider" />
          <button className="context-menu-item danger" onClick={handleDelete}>
            <Trash2 size={14} />
            删除笔记块
          </button>
        </div>
      </>
    );
  };

  if (viewMode === 'compact') {
    return (
      <>
        <div
          ref={setNodeRef}
          style={style}
          className={`note-block-compact ${isSelected ? 'selected' : ''}`}
          onClick={onSelect}
          onContextMenu={handleContextMenu}
        >
          <span className="note-block-drag-handle" {...attributes} {...listeners}>
            <GripVertical size={12} />
          </span>
          <span className="note-block-compact-title">{block.title || 'Untitled'}</span>
          <span className="note-block-compact-meta">{lines}L</span>
          <button className="note-block-copy-btn" onClick={handleCopy}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
        {renderContextMenu()}
      </>
    );
  }

  if (viewMode === 'card') {
    return (
      <>
        <div
          ref={setNodeRef}
          style={style}
          className={`note-block-card ${isSelected ? 'selected' : ''}`}
          onClick={onSelect}
          onContextMenu={handleContextMenu}
        >
          <div className="note-block-card-header">
            <span className="note-block-drag-handle" {...attributes} {...listeners}>
              <GripVertical size={14} />
            </span>
            <span className="note-block-card-title">{block.title || 'Untitled'}</span>
            <button className="note-block-copy-btn" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <div className="note-block-card-content">{contentPreview}</div>
          {block.tags.length > 0 && (
            <div className="note-block-card-tags">
              {block.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="note-block-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
        {renderContextMenu()}
      </>
    );
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`note-block-list ${isSelected ? 'selected' : ''}`}
        onClick={onSelect}
        onContextMenu={handleContextMenu}
      >
        <span className="note-block-drag-handle" {...attributes} {...listeners}>
          <GripVertical size={14} />
        </span>
        <div className="note-block-list-content">
          <div className="note-block-list-title">{block.title || 'Untitled'}</div>
          <div className="note-block-list-preview">{contentPreview}</div>
        </div>
        <button className="note-block-copy-btn" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      {renderContextMenu()}
    </>
  );
};

export default React.memo(NoteBlockItem);
