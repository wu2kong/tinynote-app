import React, { useState, useEffect } from 'react';
import { NoteBlock as NoteBlockType, ViewMode } from '@/types';
import { Copy, Check, GripVertical, Plus, Trash2, CopyPlus, ClipboardPaste, Globe } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useStore } from '@/store/useStore';
import { serializeNoteBlocks, parseNoteBlocks } from '@/utils/noteParser';
import { extractHttpLinks } from '@/utils/extractLinks';
import ContextMenuPortal from './ContextMenuPortal';
import LinksModal from './LinksModal';
import { showToast } from './Toast';

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
  const [clipboardHasNote, setClipboardHasNote] = useState(false);
  const [linksModalOpen, setLinksModalOpen] = useState(false);
  const [extractedLinks, setExtractedLinks] = useState<string[]>([]);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });

  const addNoteBlockAtIndex = useStore((s) => s.addNoteBlockAtIndex);
  const duplicateNoteBlock = useStore((s) => s.duplicateNoteBlock);
  const deleteNoteBlock = useStore((s) => s.deleteNoteBlock);
  const pasteNoteBlock = useStore((s) => s.pasteNoteBlock);

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

  const getBlockLinks = () => {
    const text = block.title ? `${block.title}\n${block.content}` : block.content;
    return extractHttpLinks(text);
  };

  const hasLinks = getBlockLinks().length > 0;

  const handleExtractLinks = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const links = getBlockLinks();

    if (links.length === 1) {
      try {
        await openUrl(links[0]);
      } catch {
        showToast('无法打开链接');
      }
      return;
    }

    setExtractedLinks(links);
    setLinksModalOpen(true);
  };

  const renderActionButtons = (iconSize: number) => (
    <div className="note-block-actions">
      {hasLinks && (
        <button
          className="note-block-copy-btn"
          onClick={handleExtractLinks}
          title="提取链接"
        >
          <Globe size={iconSize} />
        </button>
      )}
      <button className="note-block-copy-btn" onClick={handleCopy} title="复制正文">
        {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
      </button>
    </div>
  );

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  const handleCopyNote = async () => {
    const serialized = serializeNoteBlocks([block]);
    await copyToClipboard(serialized);
    closeContextMenu();
  };

  const handlePasteNote = async () => {
    try {
      const text = await readText();
      if (text) {
        const blocks = parseNoteBlocks(text);
        if (blocks.length > 0) {
          pasteNoteBlock(blocks[0], index + 1);
        }
      }
    } catch (e) {
      console.error('Failed to paste note:', e);
    }
    closeContextMenu();
  };

  const contentPreview = block.content.length > 100 ? block.content.slice(0, 100) + '...' : block.content;
  const lines = block.content.split('\n').length;

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    return (
      <ContextMenuPortal x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu}>
        <button className="context-menu-item" onClick={handleAddBelow}>
            <Plus size={14} />
            添加笔记块
          </button>
          <button className="context-menu-item" onClick={handleDuplicate}>
            <CopyPlus size={14} />
            创建副本
          </button>
          <button className="context-menu-item" onClick={handleAddAbove}>
            <Plus size={14} />
            在上方增加笔记块
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
          <button className="context-menu-item" onClick={handleCopyNote}>
            <CopyPlus size={14} />
            复制笔记块
          </button>
          {clipboardHasNote && (
            <button className="context-menu-item" onClick={handlePasteNote}>
              <ClipboardPaste size={14} />
              粘贴笔记
            </button>
          )}
          <div className="context-menu-divider" />
          <button className="context-menu-item danger" onClick={handleDelete}>
            <Trash2 size={14} />
            删除笔记块
          </button>
      </ContextMenuPortal>
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
          {renderActionButtons(12)}
        </div>
        {renderContextMenu()}
        <LinksModal open={linksModalOpen} onClose={() => setLinksModalOpen(false)} links={extractedLinks} />
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
            {renderActionButtons(14)}
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
        <LinksModal open={linksModalOpen} onClose={() => setLinksModalOpen(false)} links={extractedLinks} />
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
        {renderActionButtons(14)}
      </div>
      {renderContextMenu()}
      <LinksModal open={linksModalOpen} onClose={() => setLinksModalOpen(false)} links={extractedLinks} />
    </>
  );
};

export default React.memo(NoteBlockItem);
