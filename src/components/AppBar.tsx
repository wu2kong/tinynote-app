import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/store/useStore';
import { Space, SpaceGroupDef } from '@/types';
import * as config from '@/utils/config';
import { ALL_SPACE_GROUP_ID } from '@/utils/configTypes';

const DEFAULT_APP_BAR_WIDTH = 200;
const MIN_APP_BAR_WIDTH = 120;
const MAX_APP_BAR_WIDTH = 400;
const COLLAPSED_APP_BAR_WIDTH = 52;
import {
  Plus, Sun, Moon, Settings, PanelLeftClose, PanelLeftOpen,
  Edit3, Trash2, Smile, GripVertical, FolderOpen, Search, Copy,
  Tags, Check, ChevronDown, ChevronRight,
} from 'lucide-react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
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
import { showToast } from './Toast';
import { SPACE_EMOJI_OPTIONS } from '@/utils/spaceIcons';
import { useI18n } from '@/i18n/useI18n';

interface SpaceItemProps {
  space: Space;
  isActive: boolean;
  isCollapsed: boolean;
  onSelect: (space: Space) => void;
  onContextMenu: (e: React.MouseEvent, space: Space) => void;
  dragHandle?: {
    attributes: React.HTMLAttributes<HTMLElement>;
    listeners?: Record<string, Function>;
    setNodeRef: (node: HTMLElement | null) => void;
    style?: React.CSSProperties;
  };
}

const SpaceItem: React.FC<SpaceItemProps> = ({
  space, isActive, isCollapsed, onSelect, onContextMenu, dragHandle,
}) => {
  const icon = space.icon || space.name.charAt(0).toUpperCase();
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);

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
        ref={dragHandle?.setNodeRef}
        style={dragHandle?.style}
        className={`app-bar-space ${isActive ? 'active' : ''}`}
        onClick={() => onSelect(space)}
        onContextMenu={(e) => onContextMenu(e, space)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="app-bar-space-icon-row">
          {dragHandle && (
            <span className="app-bar-drag-handle" {...dragHandle.attributes} {...dragHandle.listeners}>
              <GripVertical size={12} />
            </span>
          )}
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

interface SortableSpaceItemProps {
  space: Space;
  isActive: boolean;
  isCollapsed: boolean;
  onSelect: (space: Space) => void;
  onContextMenu: (e: React.MouseEvent, space: Space) => void;
}

const SortableSpaceItem: React.FC<SortableSpaceItemProps> = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.space.id });

  return (
    <SpaceItem
      {...props}
      dragHandle={{
        attributes,
        listeners,
        setNodeRef,
        style: {
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
        },
      }}
    />
  );
};

function spaceBelongsToGroup(space: Space, groupId: string): boolean {
  if (groupId === ALL_SPACE_GROUP_ID) return true;
  return (space.groupIds ?? []).includes(groupId);
}

interface AppBarProps {
  onOpenGlobalSearch: () => void;
}

const AppBar: React.FC<AppBarProps> = ({ onOpenGlobalSearch }) => {
  const { t } = useI18n();
  const spaces = useStore((s) => s.spaces);
  const currentSpace = useStore((s) => s.currentSpace);
  const isDarkTheme = useStore((s) => s.isDarkTheme);
  const isSidebarCollapsed = useStore((s) => s.isSidebarCollapsed);
  const spaceGroups = useStore((s) => s.spaceGroups);
  const currentSpaceGroupId = useStore((s) => s.currentSpaceGroupId);
  const spaceGroupDisplayMode = useStore((s) => s.spaceGroupDisplayMode);
  const selectSpace = useStore((s) => s.selectSpace);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const addSpace = useStore((s) => s.addSpace);
  const deleteSpaceAction = useStore((s) => s.deleteSpace);
  const renameSpaceAction = useStore((s) => s.renameSpace);
  const updateSpaceIconAction = useStore((s) => s.updateSpaceIcon);
  const reorderSpacesAction = useStore((s) => s.reorderSpaces);
  const setCurrentSpaceGroup = useStore((s) => s.setCurrentSpaceGroup);
  const toggleSpaceGroupMembership = useStore((s) => s.toggleSpaceGroupMembership);
  const addSpaceGroup = useStore((s) => s.addSpaceGroup);
  const renameSpaceGroup = useStore((s) => s.renameSpaceGroup);

  const [showAddSpace, setShowAddSpace] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; space: Space } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerSpace, setEmojiPickerSpace] = useState<Space | null>(null);
  const [renameModal, setRenameModal] = useState<{ open: boolean; space: Space | null }>({ open: false, space: null });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; space: Space | null }>({ open: false, space: null });
  const [addGroupModal, setAddGroupModal] = useState<{ open: boolean; space: Space | null }>({ open: false, space: null });
  const [renameGroupModal, setRenameGroupModal] = useState<{ open: boolean; group: SpaceGroupDef | null }>({
    open: false,
    group: null,
  });
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [panelWidth, setPanelWidth] = useState(
    () => config.getConfig().appBarWidth ?? DEFAULT_APP_BAR_WIDTH
  );
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  const groupingEnabled = spaceGroupDisplayMode !== 'disabled';
  const useCollapseMode = groupingEnabled && spaceGroupDisplayMode === 'collapse';
  const useDropdownMode = groupingEnabled && spaceGroupDisplayMode === 'dropdown';

  const visibleSpaces = useMemo(() => {
    if (!groupingEnabled || useCollapseMode || currentSpaceGroupId === ALL_SPACE_GROUP_ID) {
      return spaces;
    }
    return spaces.filter((space) => spaceBelongsToGroup(space, currentSpaceGroupId));
  }, [spaces, groupingEnabled, useCollapseMode, currentSpaceGroupId]);

  const collapseSections = useMemo(() => {
    if (!useCollapseMode) return [] as { id: string; name: string; spaces: Space[] }[];
    const ungrouped = spaces.filter((space) => (space.groupIds ?? []).length === 0);
    const sections: { id: string; name: string; spaces: Space[] }[] = [
      {
        id: ALL_SPACE_GROUP_ID,
        name: t('appBar.allGroups'),
        spaces: ungrouped,
      },
    ];
    for (const group of spaceGroups) {
      sections.push({
        id: group.id,
        name: group.name,
        spaces: spaces.filter((space) => spaceBelongsToGroup(space, group.id)),
      });
    }
    return sections;
  }, [useCollapseMode, spaces, spaceGroups, t]);

  useEffect(() => {
    if (!groupingEnabled || useCollapseMode || currentSpaceGroupId === ALL_SPACE_GROUP_ID) return;
    if (visibleSpaces.length === 0) return;
    if (currentSpace && visibleSpaces.some((space) => space.id === currentSpace.id)) return;
    void selectSpace(visibleSpaces[0]);
  }, [groupingEnabled, useCollapseMode, currentSpaceGroupId, visibleSpaces, currentSpace, selectSpace]);

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

  const handleCopyDirectory = async (space: Space) => {
    try {
      await writeText(space.path);
      showToast(t('appBar.directoryCopied'));
    } catch {
      try {
        await navigator.clipboard.writeText(space.path);
        showToast(t('appBar.directoryCopied'));
      } catch {
        showToast(t('appBar.copyDirectoryFailed'));
      }
    }
    closeContextMenu();
  };

  const handleToggleGroup = (space: Space, group: SpaceGroupDef) => {
    toggleSpaceGroupMembership(space, group.id);
  };

  const handleAddGroupForSpace = (space: Space) => {
    setAddGroupModal({ open: true, space });
    closeContextMenu();
  };

  const handleRenameGroup = (group: SpaceGroupDef) => {
    setRenameGroupModal({ open: true, group });
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

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const renderSpaceList = (list: Space[], enableDnd: boolean) => {
    if (!enableDnd) {
      return list.map((space) => (
        <SpaceItem
          key={space.id}
          space={space}
          isActive={currentSpace?.id === space.id}
          isCollapsed={isSidebarCollapsed}
          onSelect={selectSpace}
          onContextMenu={handleContextMenu}
        />
      ));
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={list.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {list.map((space) => (
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
    );
  };

  const currentGroupLabel = currentSpaceGroupId === ALL_SPACE_GROUP_ID
    ? t('appBar.allGroups')
    : (spaceGroups.find((group) => group.id === currentSpaceGroupId)?.name ?? t('appBar.allGroups'));

  return (
    <div
      className={`app-bar ${isSidebarCollapsed ? 'collapsed' : 'expanded'}${isResizingPanel ? ' app-bar-resizing' : ''}`}
      style={isSidebarCollapsed
        ? { width: COLLAPSED_APP_BAR_WIDTH, minWidth: COLLAPSED_APP_BAR_WIDTH }
        : { width: panelWidth, minWidth: panelWidth }}
    >
      <div className="app-bar-header">
        <div className="app-bar-logo">📝</div>
        {!isSidebarCollapsed && (
          <div className="app-bar-brand">
            <span className="app-bar-app-name">TinyNote</span>
            <span className="app-bar-slogan">{t('appBar.slogan')}</span>
          </div>
        )}
      </div>

      {useDropdownMode && !isSidebarCollapsed && (
        <div className="app-bar-group-switcher">
          <select
            className="app-bar-group-select"
            value={currentSpaceGroupId}
            onChange={(e) => setCurrentSpaceGroup(e.target.value)}
            title={t('appBar.switchGroup')}
            aria-label={t('appBar.switchGroup')}
          >
            <option value={ALL_SPACE_GROUP_ID}>{t('appBar.allGroups')}</option>
            {spaceGroups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
      )}

      {useDropdownMode && isSidebarCollapsed && (
        <button
          className="app-bar-btn app-bar-group-collapsed-btn"
          title={`${t('appBar.switchGroup')}: ${currentGroupLabel}`}
          onClick={() => {
            const options = [ALL_SPACE_GROUP_ID, ...spaceGroups.map((group) => group.id)];
            const index = options.indexOf(currentSpaceGroupId);
            const next = options[(index + 1) % options.length] ?? ALL_SPACE_GROUP_ID;
            setCurrentSpaceGroup(next);
          }}
        >
          <Tags size={18} />
        </button>
      )}

      <div className="app-bar-spaces">
        {useCollapseMode ? (
          collapseSections.map((section) => {
            const isSectionCollapsed = Boolean(collapsedSections[section.id]);
            return (
              <div key={section.id} className="app-bar-group-section">
                {!isSidebarCollapsed && (
                  <button
                    type="button"
                    className="app-bar-group-section-header"
                    onClick={() => toggleSection(section.id)}
                    onContextMenu={(e) => {
                      if (section.id === ALL_SPACE_GROUP_ID) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const group = spaceGroups.find((item) => item.id === section.id);
                      if (group) handleRenameGroup(group);
                    }}
                    title={section.id === ALL_SPACE_GROUP_ID ? undefined : t('appBar.renameGroupHint')}
                  >
                    {isSectionCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <span className="app-bar-group-section-title">{section.name}</span>
                    <span className="app-bar-group-section-count">{section.spaces.length}</span>
                  </button>
                )}
                {!isSectionCollapsed && renderSpaceList(section.spaces, false)}
              </div>
            );
          })
        ) : (
          renderSpaceList(visibleSpaces, true)
        )}
        <button
          className="app-bar-space-add"
          onClick={() => setShowAddSpace(true)}
          title={t('appBar.newSpace')}
        >
          <Plus size={16} />
          {!isSidebarCollapsed && <span className="app-bar-space-name">{t('appBar.newSpace')}</span>}
        </button>
      </div>

      <div className="app-bar-footer">
        <button className="app-bar-btn" onClick={onOpenGlobalSearch} title={t('appBar.globalSearchShortcut')}>
          <Search size={18} />
          {!isSidebarCollapsed && <span className="app-bar-btn-label">{t('appBar.globalSearch')}</span>}
        </button>
        <button className="app-bar-btn" onClick={toggleSidebar} title={t('appBar.collapseExpand')}>
          {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!isSidebarCollapsed && <span className="app-bar-btn-label">{t('appBar.collapseExpand')}</span>}
        </button>
        <button className="app-bar-btn" onClick={toggleTheme} title={t('appBar.toggleTheme')}>
          {isDarkTheme ? <Sun size={18} /> : <Moon size={18} />}
          {!isSidebarCollapsed && <span className="app-bar-btn-label">{t('appBar.toggleTheme')}</span>}
        </button>
        <button
          className="app-bar-btn"
          onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}
          title={t('appBar.settings')}
        >
          <Settings size={18} />
          {!isSidebarCollapsed && <span className="app-bar-btn-label">{t('appBar.settings')}</span>}
        </button>
      </div>

      {contextMenu && (
        <ContextMenuPortal x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu}>
          <button className="context-menu-item" onClick={() => handleRename(contextMenu.space)}>
              <Edit3 size={14} />
              {t('appBar.rename')}
            </button>
            <button className="context-menu-item" onClick={() => handleChangeIcon(contextMenu.space)}>
              <Smile size={14} />
              {t('appBar.changeIcon')}
            </button>
            <button className="context-menu-item" onClick={() => handleOpenDirectory(contextMenu.space)}>
              <FolderOpen size={14} />
              {t('appBar.openDirectory')}
            </button>
            <button className="context-menu-item" onClick={() => handleCopyDirectory(contextMenu.space)}>
              <Copy size={14} />
              {t('appBar.copyDirectory')}
            </button>
            <div className="context-menu-divider" />
            <div className="context-menu-submenu">
              <button className="context-menu-item" onClick={(e) => { e.stopPropagation(); }}>
                <span className="context-menu-item-inner"><Tags size={14} />{t('appBar.modifyGroups')}</span>
              </button>
              <div className="context-menu-sub">
                <button
                  className="context-menu-item"
                  onClick={() => handleAddGroupForSpace(contextMenu.space)}
                >
                  <Plus size={14} />
                  {t('appBar.addGroup')}
                </button>
                {spaceGroups.length > 0 && <div className="context-menu-divider" />}
                {spaceGroups.map((group) => {
                  const liveSpace = spaces.find((s) => s.id === contextMenu.space.id) ?? contextMenu.space;
                  const checked = (liveSpace.groupIds ?? []).includes(group.id);
                  return (
                    <div key={group.id} className="context-menu-item-row">
                      <button
                        type="button"
                        className="context-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleGroup(liveSpace, group);
                        }}
                      >
                        <span className="context-menu-check">{checked ? <Check size={14} /> : null}</span>
                        <span className="context-menu-item-label">{group.name}</span>
                      </button>
                      <button
                        type="button"
                        className="context-menu-item-action"
                        title={t('appBar.renameGroup')}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenameGroup(group);
                        }}
                      >
                        <Edit3 size={13} />
                      </button>
                    </div>
                  );
                })}
                {spaceGroups.length === 0 && (
                  <div className="context-menu-empty">{t('appBar.noGroupsYet')}</div>
                )}
              </div>
            </div>
            <div className="context-menu-divider" />
            <button className="context-menu-item danger" onClick={() => handleDelete(contextMenu.space)}>
              <Trash2 size={14} />
              {t('appBar.delete')}
            </button>
        </ContextMenuPortal>
      )}

      {showEmojiPicker && emojiPickerSpace && (
        <>
          <div className="modal-overlay" onClick={() => { setShowEmojiPicker(false); setEmojiPickerSpace(null); }} />
          <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
            <div className="emoji-picker-title">{t('appBar.chooseIcon')}</div>
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
        title={t('appBar.renameSpace')}
        placeholder={t('appBar.newName')}
        defaultValue={renameModal.space?.name || ''}
        confirmLabel={t('common.save')}
      />

      <ConfirmModal
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, space: null })}
        onConfirm={() => {
          if (deleteConfirm.space) deleteSpaceAction(deleteConfirm.space);
          setDeleteConfirm({ open: false, space: null });
        }}
        title={t('appBar.deleteSpace')}
        message={t('appBar.deleteSpaceConfirm', { name: deleteConfirm.space?.name ?? '' })}
      />

      <InputModal
        open={showAddSpace}
        onClose={() => setShowAddSpace(false)}
        onSubmit={(name) => { addSpace(name); setShowAddSpace(false); }}
        title={t('appBar.newSpace')}
        placeholder={t('appBar.spaceName')}
      />

      <InputModal
        open={addGroupModal.open}
        onClose={() => setAddGroupModal({ open: false, space: null })}
        onSubmit={(name) => {
          if (addGroupModal.space) {
            const id = addSpaceGroup(name, addGroupModal.space);
            if (id) {
              showToast(t('appBar.groupAdded', { name: name.trim() }));
            }
          }
          setAddGroupModal({ open: false, space: null });
        }}
        title={t('appBar.addGroup')}
        placeholder={t('appBar.groupName')}
      />

      <InputModal
        open={renameGroupModal.open}
        onClose={() => setRenameGroupModal({ open: false, group: null })}
        onSubmit={(name) => {
          if (renameGroupModal.group) {
            const ok = renameSpaceGroup(renameGroupModal.group.id, name);
            if (ok) {
              showToast(t('appBar.groupRenamed', { name: name.trim() }));
            } else {
              showToast(t('appBar.groupRenameFailed'));
            }
          }
          setRenameGroupModal({ open: false, group: null });
        }}
        title={t('appBar.renameGroup')}
        placeholder={t('appBar.groupName')}
        defaultValue={renameGroupModal.group?.name || ''}
        confirmLabel={t('common.save')}
      />

      {!isSidebarCollapsed && (
        <div
          className="app-bar-resize-handle"
          onPointerDown={handlePanelResizeStart}
          title={t('appBar.resizeWidth')}
        />
      )}
    </div>
  );
};

export default AppBar;
