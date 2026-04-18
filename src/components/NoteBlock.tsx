import React, { useState } from 'react';
import { NoteBlock as NoteBlockType, ViewMode } from '@/types';
import { Copy, Check, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

interface NoteBlockProps {
  block: NoteBlockType;
  viewMode: ViewMode;
  isSelected: boolean;
  onSelect: () => void;
}

const NoteBlockItem: React.FC<NoteBlockProps> = ({ block, viewMode, isSelected, onSelect }) => {
  const [copied, setCopied] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await writeText(block.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(block.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };

  const contentPreview = block.content.length > 100 ? block.content.slice(0, 100) + '...' : block.content;
  const lines = block.content.split('\n').length;

  if (viewMode === 'compact') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`note-block-compact ${isSelected ? 'selected' : ''}`}
        onClick={onSelect}
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
    );
  }

  if (viewMode === 'card') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`note-block-card ${isSelected ? 'selected' : ''}`}
        onClick={onSelect}
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
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`note-block-list ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
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
  );
};

export default React.memo(NoteBlockItem);