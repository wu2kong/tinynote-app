import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { isGroup, isNotebook } from '@/types/guards';
import { Group, Notebook } from '@/types';
import {
  Search, Folder, FileText, ChevronRight, ChevronDown,
  Trash2, FolderPlus, FilePlus, Edit3, Plus, Code, Blocks
} from 'lucide-react';
import InputModal from './InputModal';
import ConfirmModal from './ConfirmModal';

const DirectoryPanel: React.FC = () => {
  const currentSpace = useStore((s) => s.currentSpace);
  const currentGroup = useStore((s) => s.currentGroup);
  const currentNotebook = useStore((s) => s.currentNotebook);
  const searchQuery = useStore((s) => s.searchQuery);
  const expandedGroupPaths = useStore((s) => s.expandedGroupPaths);
  const selectGroup = useStore((s) => s.selectGroup);
  const selectNotebook = useStore((s) => s.selectNotebook);
  const toggleExpandedGroupPath = useStore((s) => s.toggleExpandedGroupPath);
  const addGroup = useStore((s) => s.addGroup);
  const addNotebook = useStore((s) => s.addNotebook);
  const storeDeleteGroup = useStore((s) => s.deleteGroup);
  const storeDeleteNotebook = useStore((s) => s.deleteNotebook);
  const storeRenameGroup = useStore((s) => s.renameGroup);
  const storeRenameNotebook = useStore((s) => s.renameNotebook);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const toggleSourceMode = useStore((s) => s.toggleSourceMode);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: Group | Notebook } | null>(null);
  const [blankContextMenu, setBlankContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [modalState, setModalState] = useState<{
    open: boolean;
    title: string;
    placeholder: string;
    defaultValue: string;
    confirmLabel: string;
    onSubmit: (value: string) => void;
  }>({ open: false, title: '', placeholder: '', defaultValue: '', confirmLabel: 'Create', onSubmit: () => {} });
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const handleContextMenu = (e: React.MouseEvent, item: Group | Notebook) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const closeContextMenu = () => { setContextMenu(null); setBlankContextMenu(null); };

  const handleBlankContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.tree-item')) return;
    e.preventDefault();
    closeContextMenu();
    setBlankContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleAddGroup = (parentPath: string) => {
    setModalState({
      open: true,
      title: '新建分组',
      placeholder: '分组名称',
      defaultValue: '',
      confirmLabel: '新建',
      onSubmit: (name) => {
        addGroup(parentPath, name);
        setModalState((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleAddNotebook = (parentPath: string) => {
    setModalState({
      open: true,
      title: '新建笔记本',
      placeholder: '笔记本名称',
      defaultValue: '',
      confirmLabel: '新建',
      onSubmit: (name) => {
        addNotebook(parentPath, name);
        setModalState((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleRenameGroup = (group: Group) => {
    setModalState({
      open: true,
      title: '重命名分组',
      placeholder: '新名称',
      defaultValue: group.name,
      confirmLabel: '保存',
      onSubmit: (name) => {
        storeRenameGroup(group, name);
        setModalState((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleRenameNotebook = (notebook: Notebook) => {
    setModalState({
      open: true,
      title: '重命名笔记本',
      placeholder: '新名称',
      defaultValue: notebook.name,
      confirmLabel: '保存',
      onSubmit: (name) => {
        storeRenameNotebook(notebook, name);
        setModalState((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleDeleteGroup = (group: Group) => {
    setConfirmState({
      open: true,
      title: '删除分组',
      message: `确定要删除「${group.name}」吗？`,
      onConfirm: () => {
        storeDeleteGroup(group);
        setConfirmState((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleDeleteNotebook = (notebook: Notebook) => {
    setConfirmState({
      open: true,
      title: '删除笔记本',
      message: `确定要删除「${notebook.name}」吗？`,
      onConfirm: () => {
        storeDeleteNotebook(notebook);
        setConfirmState((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const filterItems = (items: (Group | Notebook)[]): (Group | Notebook)[] => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) => {
      if (item.name.toLowerCase().includes(q)) return true;
      if (isGroup(item)) {
        return filterItems(item.children).length > 0;
      }
      return false;
    });
  };

  const renderTree = (items: (Group | Notebook)[], depth: number = 0): React.ReactNode => {
    const filtered = filterItems(items);
    return filtered.map((item) => {
      if (isGroup(item)) {
        const group = item as Group;
        const isExpanded = expandedGroupPaths.includes(group.path);
        return (
          <div key={group.id}>
            <div
              className={`tree-item ${currentGroup?.path === group.path ? 'active' : ''}`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              onClick={() => { toggleExpandedGroupPath(group.path); selectGroup(group); }}
              onContextMenu={(e) => handleContextMenu(e, group)}
            >
              <span className="tree-icon">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <Folder size={14} className="tree-folder-icon" />
              <span className="tree-name">{group.name}</span>
              <button
                className="tree-item-action"
                onClick={(e) => { e.stopPropagation(); handleAddNotebook(group.path); }}
title="新建笔记本"
              >
                <Plus size={12} />
              </button>
              <span className="tree-badge">{group.notebookCount}</span>
            </div>
            {isExpanded && renderTree(group.children, depth + 1)}
          </div>
        );
      }

      const notebook = item as Notebook;
      return (
        <div
          key={notebook.id}
          className={`tree-item notebook ${currentNotebook?.path === notebook.path ? 'active' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => selectNotebook(notebook)}
          onContextMenu={(e) => handleContextMenu(e, notebook)}
        >
          <span className="tree-icon" style={{ visibility: 'hidden' }}>
            <ChevronRight size={14} />
          </span>
          <FileText size={14} className="tree-file-icon" />
          <span className="tree-name">{notebook.name}</span>
        </div>
      );
    });
  };

  return (
    <div className="directory-panel">
      <div className="directory-header">
        <div className="directory-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="搜索笔记本..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="directory-tree" onContextMenu={handleBlankContextMenu}>
        {currentSpace ? renderTree(currentSpace.groups) : (
          <div className="directory-empty">选择一个空间以浏览</div>
        )}
      </div>

      {contextMenu && (
        <>
          <div className="context-menu-overlay" onClick={closeContextMenu} />
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {isNotebook(contextMenu.item) && currentNotebook?.path === (contextMenu.item as Notebook).path && (
              <button className="context-menu-item" onClick={() => {
                toggleSourceMode();
                closeContextMenu();
              }}>
                {currentNotebook.isSourceMode ? <Blocks size={14} /> : <Code size={14} />}
                {currentNotebook.isSourceMode ? '笔记块模式' : '源码模式'}
              </button>
            )}
            {isGroup(contextMenu.item) && (
              <>
                <button className="context-menu-item" onClick={() => {
                  handleAddGroup((contextMenu.item as Group).path);
                  closeContextMenu();
                }}>
                  <FolderPlus size={14} />
                  新建子分组
                </button>
                <button className="context-menu-item" onClick={() => {
                  handleAddNotebook((contextMenu.item as Group).path);
                  closeContextMenu();
                }}>
                  <FilePlus size={14} />
                  新建笔记本
                </button>
              </>
            )}
            <div className="context-menu-divider" />
            <button className="context-menu-item" onClick={() => {
              if (isGroup(contextMenu!.item)) handleRenameGroup(contextMenu!.item as Group);
              else handleRenameNotebook(contextMenu!.item as Notebook);
              closeContextMenu();
            }}>
              <Edit3 size={14} />
              重命名
            </button>
            <button className="context-menu-item danger" onClick={() => {
              if (isGroup(contextMenu!.item)) handleDeleteGroup(contextMenu!.item as Group);
              else handleDeleteNotebook(contextMenu!.item as Notebook);
              closeContextMenu();
            }}>
              <Trash2 size={14} />
              删除
            </button>
          </div>
        </>
      )}

      {blankContextMenu && currentSpace && (
        <>
          <div className="context-menu-overlay" onClick={closeContextMenu} />
          <div
            className="context-menu"
            style={{ top: blankContextMenu.y, left: blankContextMenu.x }}
          >
            <button className="context-menu-item" onClick={() => {
              handleAddGroup(currentSpace.path);
              closeContextMenu();
            }}>
              <FolderPlus size={14} />
              新增分组
            </button>
            <button className="context-menu-item" onClick={() => {
              handleAddNotebook(currentSpace.path);
              closeContextMenu();
            }}>
              <FilePlus size={14} />
              新建笔记本
            </button>
          </div>
        </>
      )}

      <InputModal
        open={modalState.open}
        onClose={() => setModalState((prev) => ({ ...prev, open: false }))}
        onSubmit={modalState.onSubmit}
        title={modalState.title}
        placeholder={modalState.placeholder}
        defaultValue={modalState.defaultValue}
        confirmLabel={modalState.confirmLabel}
      />

      <ConfirmModal
        open={confirmState.open}
        onClose={() => setConfirmState((prev) => ({ ...prev, open: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
      />
    </div>
  );
};

export default DirectoryPanel;