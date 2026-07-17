import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/store/useStore';
import { Space } from '@/types';
import * as config from '@/utils/config';

const DEFAULT_APP_BAR_WIDTH = 200;
const MIN_APP_BAR_WIDTH = 120;
const MAX_APP_BAR_WIDTH = 400;
const COLLAPSED_APP_BAR_WIDTH = 52;
import {
  Plus, Sun, Moon, Settings, PanelLeftClose, PanelLeftOpen,
  Edit3, Trash2, Smile, GripVertical, FolderOpen, Search
} from 'lucide-react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import InputModal from './InputModal';
import ConfirmModal from './ConfirmModal';
import { OPEN_SETTINGS_EVENT } from '@/utils/workspaceActions';
import ContextMenuPortal from './ContextMenuPortal';
import { SPACE_EMOJI_OPTIONS } from '@/utils/spaceIcons';

interface SortableSpaceItemProps {
  space: Space;
  isActive: boolean;
  isCollapsed: boolean;
  onSelect: (space: Space) => void;
  onContextMenu: (e: React.MouseEvent, space: Space) => void;
}

const SortableSpaceItem: React.FC<SortableSpaceItemProps> = ({
  space, isActive, isCollapsed, onSelect, onContextMenu
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: space.id });
  const icon = space.icon || space.name.charAt(0).toUpperCase();
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (isCollapsed) {
      setTooltipRect(e.currentTarget.getBoundingClientRect());
    }
  }, [isCollapsed]);

  const handleMouseLeave = useCallback(() => {
    setTooltipRect(null);
  }, []);

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`app-bar-space ${isActive ? 'active' : ''}`}
        onClick={() => onSelect(space)}
        onContextMenu={(e) => onContextMenu(e, space)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="app-bar-space-icon-row">
          <span className="app-bar-drag-handle" {...attributes} {...listeners}>
            <GripVertical size={12} />
          </span>
          <span className="app-bar-space-icon">{icon}</span>
        </div>
        {!isCollapsed && <span className="app-bar-space-name">{space.name}</span>}
      </div>
      {tooltipRect && createPortal(
        <div className="app-bar-tooltip" style={{
          position: 'fixed',
          left: tooltipRect.right + 8,
          top: tooltipRect.top + tooltipRect.height / 2,
          transform: 'translateY(-50%)',
        }}>
          {space.name}
        </div>,
        document.body
      )}
    </>
  );
};

interface AppBarProps {
  onOpenGlobalSearch: () => void;
}

const AppBar: React.FC<AppBarProps> = ({ onOpenGlobalSearch }) => {
  const spaces = useStore((s) => s.spaces);
  const currentSpace = useStore((s) => s.currentSpace);
  const isDarkTheme = useStore((s) => s.isDarkTheme);
  const isSidebarCollapsed = useStore((s) => s.isSidebarCollapsed);
  const selectSpace = useStore((s) => s.selectSpace);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const addSpace = useStore((s) => s.addSpace);
  const deleteSpaceAction = useStore((s) => s.deleteSpace);
  const renameSpaceAction = useStore((s) => s.renameSpace);
  const updateSpaceIconAction = useStore((s) => s.updateSpaceIcon);
  const reorderSpacesAction = useStore((s) => s.reorderSpaces);

  const [showAddSpace, setShowAddSpace] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; space: Space } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerSpace, setEmojiPickerSpace] = useState<Space | null>(null);
  const [renameModal, setRenameModal] = useState<{ open: boolean; space: Space | null }>({ open: false, space: null });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; space: Space | null }>({ open: false, space: null });
  const [panelWidth, setPanelWidth] = useState(
    () => config.getConfig().appBarWidth ?? DEFAULT_APP_BAR_WIDTH
  );
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  const handlePanelResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = panelWidthRef.current;
    setIsResizingPanel(true);
    document.body.classList.add('app-bar-resizing');

    const onPointerMove = (ev: PointerEvent) => {
      const nextWidth = Math.min(
        MAX_APP_BAR_WIDTH,
        Math.max(MIN_APP_BAR_WIDTH, startWidth + ev.clientX - startX)
      );
      setPanelWidth(nextWidth);
    };

    const onPointerUp = () => {
      setIsResizingPanel(false);
      document.body.classList.remove('app-bar-resizing');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      config.saveConfig({ appBarWidth: panelWidthRef.current });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleContextMenu = (e: React.MouseEvent, space: Space) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, space });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleRename = (space: Space) => {
    setRenameModal({ open: true, space });
    closeContextMenu();
  };

  const handleChangeIcon = (space: Space) => {
    setEmojiPickerSpace(space);
    setShowEmojiPicker(true);
    closeContextMenu();
  };

  const handleDelete = (space: Space) => {
    setDeleteConfirm({ open: true, space });
    closeContextMenu();
  };

  const handleOpenDirectory = async (space: Space) => {
    try {
      await revealItemInDir(space.path);
    } catch (e) {
      console.error('Failed to reveal directory:', e);
    }
    closeContextMenu();
  };

  const handleDragEnd = (event: import('@dnd-kit/core').DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = spaces.findIndex((s) => s.id === active.id);
    const newIndex = spaces.findIndex((s) => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderSpacesAction(oldIndex, newIndex);
    }
  };

  return (
    <div
      className={`app-bar ${isSidebarCollapsed ? 'collapsed' : 'expanded'}${isResizingPanel ? ' app-bar-resizing' : ''}`}
      style={isSidebarCollapsed
        ? { width: COLLAPSED_APP_BAR_WIDTH, minWidth: COLLAPSED_APP_BAR_WIDTH }
        : { width: panelWidth, minWidth: panelWidth }}
    >
      <div className="app-bar-header">
        <div className="app-bar-logo">📝</div>
        {!isSidebarCollapsed && <span className="app-bar-app-name">TinyNote</span>}
      </div>

      <div className="app-bar-spaces">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={spaces.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {spaces.map((space) => (
              <SortableSpaceItem
                key={space.id}
                space={space}
                isActive={currentSpace?.id === space.id}
                isCollapsed={isSidebarCollapsed}
                onSelect={selectSpace}
                onContextMenu={handleContextMenu}
              />
            ))}
          </SortableContext>
        </DndContext>
        <button
          className="app-bar-space-add"
          onClick={() => setShowAddSpace(true)}
          title="新建空间"
        >
          <Plus size={16} />
          {!isSidebarCollapsed && <span className="app-bar-space-name">新建空间</span>}
        </button>
      </div>

      <div className="app-bar-footer">
        <button className="app-bar-btn" onClick={onOpenGlobalSearch} title="全局搜索 (⌘⇧F / Ctrl+Shift+F)">
          <Search size={18} />
          {!isSidebarCollapsed && <span className="app-bar-btn-label">全局搜索</span>}
        </button>
        <button className="app-bar-btn" onClick={toggleSidebar} title={isSidebarCollapsed ? '展开/收起' : '收起/展开'}>
          {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!isSidebarCollapsed && <span className="app-bar-btn-label">{isSidebarCollapsed ? '展开/收起' : '收起/展开'}</span>}
        </button>
        <button className="app-bar-btn" onClick={toggleTheme} title="切换主题">
          {isDarkTheme ? <Sun size={18} /> : <Moon size={18} />}
          {!isSidebarCollapsed && <span className="app-bar-btn-label">切换主题</span>}
        </button>
        <button
          className="app-bar-btn"
          onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}
          title="设置中心"
        >
          <Settings size={18} />
          {!isSidebarCollapsed && <span className="app-bar-btn-label">设置中心</span>}
        </button>
      </div>

      {contextMenu && (
        <ContextMenuPortal x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu}>
          <button className="context-menu-item" onClick={() => handleRename(contextMenu.space)}>
              <Edit3 size={14} />
              重命名
            </button>
            <button className="context-menu-item" onClick={() => handleChangeIcon(contextMenu.space)}>
              <Smile size={14} />
              更改图标
            </button>
            <button className="context-menu-item" onClick={() => handleOpenDirectory(contextMenu.space)}>
              <FolderOpen size={14} />
              打开目录位置
            </button>
            <div className="context-menu-divider" />
            <button className="context-menu-item danger" onClick={() => handleDelete(contextMenu.space)}>
              <Trash2 size={14} />
              删除
            </button>
        </ContextMenuPortal>
      )}

      {showEmojiPicker && emojiPickerSpace && (
        <>
          <div className="modal-overlay" onClick={() => { setShowEmojiPicker(false); setEmojiPickerSpace(null); }} />
          <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
            <div className="emoji-picker-title">选择图标</div>
            <div className="emoji-picker-grid">
              {SPACE_EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  className="emoji-picker-item"
                  onClick={() => {
                    updateSpaceIconAction(emojiPickerSpace, emoji);
                    setShowEmojiPicker(false);
                    setEmojiPickerSpace(null);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <InputModal
        open={renameModal.open}
        onClose={() => setRenameModal({ open: false, space: null })}
        onSubmit={(name) => {
          if (renameModal.space) renameSpaceAction(renameModal.space, name);
          setRenameModal({ open: false, space: null });
        }}
        title="重命名空间"
        placeholder="新名称"
        defaultValue={renameModal.space?.name || ''}
        confirmLabel="保存"
      />

      <ConfirmModal
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, space: null })}
        onConfirm={() => {
          if (deleteConfirm.space) deleteSpaceAction(deleteConfirm.space);
          setDeleteConfirm({ open: false, space: null });
        }}
        title="删除空间"
        message={`确定要删除「${deleteConfirm.space?.name}」吗？`}
      />

      <InputModal
        open={showAddSpace}
        onClose={() => setShowAddSpace(false)}
        onSubmit={(name) => { addSpace(name); setShowAddSpace(false); }}
        title="新建空间"
        placeholder="空间名称"
      />



      {!isSidebarCollapsed && (
        <div
          className="app-bar-resize-handle"
          onPointerDown={handlePanelResizeStart}
          title="拖拽调整宽度"
        />
      )}
    </div>
  );
};

export default AppBar;
