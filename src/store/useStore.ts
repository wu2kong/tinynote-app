import { create } from 'zustand';
import { AppState, Space, Group, Notebook, NoteBlock, ViewMode, ColorThemeId, RecentNotebookHistoryItem } from '@/types';
import { applyTheme, applyMinimalStyle } from '@/utils/theme';
import { isColorThemeId } from '@/themes';
import * as fs from '@/utils/fileSystem';
import * as config from '@/utils/config';
import { createNoteBlock } from '@/utils/noteParser';
import { isSubPath, normalizePath, dirname } from '@/utils/path';
import { pickRandomSpaceIcon } from '@/utils/spaceIcons';
import { GlobalSearchResult } from '@/utils/globalSearch';

interface AppActions {
  setSpace: (space: Space | null) => void;
  setGroup: (group: Group | null) => void;
  setNotebook: (notebook: Notebook | null) => void;
  setNoteBlock: (block: NoteBlock | null) => void;
  toggleTheme: () => void;
  setColorTheme: (themeId: ColorThemeId) => void;
  toggleSidebar: () => void;
  toggleAppBar: () => void;
  toggleDirectoryPanel: () => void;
  toggleHideElementBorders: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setStoragePath: (path: string | null) => Promise<void>;
  initApp: () => Promise<void>;
  selectSpace: (space: Space) => Promise<void>;
  selectGroup: (group: Group) => Promise<void>;
  selectNotebook: (notebook: Notebook) => Promise<void>;
  selectRecentNotebook: (historyItem: RecentNotebookHistoryItem) => Promise<void>;
  toggleExpandedGroupPath: (path: string) => void;
  expandAllGroups: () => void;
  collapseAllGroups: () => void;
  addSpace: (name: string) => Promise<void>;
  deleteSpace: (space: Space) => Promise<void>;
  renameSpace: (space: Space, newName: string) => Promise<void>;
  updateSpaceIcon: (space: Space, icon: string) => Promise<void>;
  reorderSpaces: (fromIndex: number, toIndex: number) => Promise<void>;
  addGroup: (parentPath: string, name: string) => Promise<void>;
  deleteGroup: (group: Group) => Promise<void>;
  renameGroup: (group: Group, newName: string) => Promise<void>;
  addNotebook: (parentPath: string, name: string) => Promise<void>;
  duplicateNotebook: (notebook: Notebook) => Promise<Notebook | null>;
  deleteNotebook: (notebook: Notebook) => Promise<void>;
  renameNotebook: (notebook: Notebook, newName: string) => Promise<void>;
  addNoteBlock: () => Promise<void>;
  addNoteBlockAtIndex: (index: number) => Promise<void>;
  duplicateNoteBlock: (id: string, index: number) => Promise<void>;
  pasteNoteBlock: (block: NoteBlock, index: number) => Promise<void>;
  pasteNoteBlockAtEnd: (block: NoteBlock) => Promise<void>;
  updateNoteBlock: (id: string, updates: Partial<NoteBlock>) => Promise<void>;
  deleteNoteBlock: (id: string) => Promise<void>;
  reorderNoteBlocks: (fromIndex: number, toIndex: number) => Promise<void>;
  reorderChildren: (parentPath: string, fromIndex: number, toIndex: number) => Promise<void>;
  toggleSourceMode: () => void;
  reloadSpaces: () => Promise<void>;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  moveItem: (itemPath: string, itemKind: 'group' | 'notebook', newParentPath: string) => Promise<void>;
  navigateToGlobalSearchResult: (result: GlobalSearchResult) => Promise<void>;
}

type AppStore = AppState & AppActions;

function findGroupByPath(items: (Group | Notebook)[], path: string): Group | null {
  const targetPath = normalizePath(path);
  for (const item of items) {
    if ('children' in item) {
      if (normalizePath(item.path) === targetPath) return item;
      const found = findGroupByPath(item.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

function findNotebookByPath(items: (Group | Notebook)[], path: string): Notebook | null {
  const targetPath = normalizePath(path);
  for (const item of items) {
    if ('noteBlocks' in item && normalizePath(item.path) === targetPath) return item;
    if ('children' in item) {
      const found = findNotebookByPath(item.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

function getAncestorPaths(items: (Group | Notebook)[], targetPath: string): string[] {
  const normalizedTarget = normalizePath(targetPath);
  const ancestors: string[] = [];
  function search(list: (Group | Notebook)[]): boolean {
    for (const item of list) {
      if (normalizePath(item.path) === normalizedTarget) return true;
      if ('children' in item) {
        if (search(item.children)) {
          ancestors.push(item.path);
          return true;
        }
      }
    }
    return false;
  }
  search(items);
  return ancestors;
}

function sortSpacesByOrder(spaces: Space[], order: string[]): Space[] {
  if (order.length === 0) return spaces;
  const ordered: Space[] = [];
  const remaining = [...spaces];
  for (const path of order) {
    const normalizedPath = normalizePath(path);
    const idx = remaining.findIndex((s) => normalizePath(s.path) === normalizedPath);
    if (idx !== -1) {
      ordered.push(remaining.splice(idx, 1)[0]);
    }
  }
  return [...ordered, ...remaining];
}

function sortChildrenByOrder(children: (Group | Notebook)[], order: string[]): (Group | Notebook)[] {
  if (order.length === 0) return children;
  const ordered: (Group | Notebook)[] = [];
  const remaining = [...children];
  for (const path of order) {
    const normalizedPath = normalizePath(path);
    const idx = remaining.findIndex((item) => normalizePath(item.path) === normalizedPath);
    if (idx !== -1) {
      ordered.push(remaining.splice(idx, 1)[0]);
    }
  }
  return [...ordered, ...remaining];
}

function sortTreeRecursively(children: (Group | Notebook)[], groupOrder: Record<string, string[]>, parentPath: string): (Group | Notebook)[] {
  const order = groupOrder[parentPath] || [];
  const sorted = sortChildrenByOrder([...children], order);
  return sorted.map((item) => {
    if ('children' in item) {
      return {
        ...item,
        children: sortTreeRecursively(item.children, groupOrder, item.path),
      };
    }
    return item;
  });
}

function applyIconsToSpaces(spaces: Space[], icons: Record<string, string>): Space[] {
  return spaces.map((s) => ({
    ...s,
    icon: icons[s.path] || s.icon,
  }));
}

function needsSpaceConfigInit(spaces: Space[], spaceOrder: string[]): boolean {
  if (spaces.length === 0) return false;
  const spacePaths = new Set(spaces.map((s) => normalizePath(s.path)));
  if (spaceOrder.length === 0) return true;
  return !spaceOrder.some((p) => spacePaths.has(normalizePath(p)));
}

function initializeSpaceConfig(
  spaces: Space[],
  existingIcons: Record<string, string>,
): { spaceOrder: string[]; spaceIcons: Record<string, string> } {
  const sorted = [...spaces].sort(
    (a, b) => fs.countSpaceNotebooks(b) - fs.countSpaceNotebooks(a),
  );
  const spaceOrder = sorted.map((s) => s.path);
  const spaceIcons = { ...existingIcons };
  const usedIcons = new Set(Object.values(spaceIcons));
  for (const space of spaces) {
    if (!spaceIcons[space.path]) {
      const icon = pickRandomSpaceIcon(usedIcons);
      spaceIcons[space.path] = icon;
      usedIcons.add(icon);
    }
  }
  return { spaceOrder, spaceIcons };
}

export const useStore = create<AppStore>((set, get) => ({
  spaces: [],
  currentSpace: null,
  currentGroup: null,
  currentNotebook: null,
  currentNoteBlock: null,
  noteBlockFocusKey: 0,
  recentNotebookHistory: [],
  isDarkTheme: false,
  colorThemeId: 'default' as ColorThemeId,
  isSidebarCollapsed: false,
  showAppBar: true,
  showDirectoryPanel: true,
  hideElementBorders: false,
  viewMode: 'list' as ViewMode,
  zoomLevel: 1,
  searchQuery: '',
  storagePath: null,
  expandedGroupPaths: [],

  setSpace: (space) => set({ currentSpace: space, currentGroup: null, currentNotebook: null, currentNoteBlock: null }),
  setGroup: (group) => set({ currentGroup: group, currentNotebook: null, currentNoteBlock: null }),
  setNotebook: (notebook) => set({ currentNotebook: notebook, currentNoteBlock: null }),
  setNoteBlock: (block) => set((state) => ({
    currentNoteBlock: block,
    noteBlockFocusKey: block ? state.noteBlockFocusKey + 1 : state.noteBlockFocusKey,
  })),

  setViewMode: (mode) => {
    set({ viewMode: mode });
    config.saveConfig({ viewMode: mode });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setStoragePath: async (path) => {
    const normalizedPath = path ? normalizePath(path) : null;
    if (normalizedPath) {
      await config.prepareWorkspace(normalizedPath);
    } else {
      config.bindWorkspace(null);
    }
    set({ storagePath: normalizedPath });
  },

  toggleTheme: () => {
    const { isDarkTheme, colorThemeId } = get();
    const next = !isDarkTheme;
    applyTheme(colorThemeId, next);
    set({ isDarkTheme: next });
    config.saveConfig({ isDarkTheme: next });
  },

  setColorTheme: (themeId) => {
    const { isDarkTheme } = get();
    applyTheme(themeId, isDarkTheme);
    set({ colorThemeId: themeId });
    config.saveConfig({ colorThemeId: themeId });
  },

  toggleSidebar: () => {
    const next = !get().isSidebarCollapsed;
    set({ isSidebarCollapsed: next });
    config.saveConfig({ isSidebarCollapsed: next });
  },

  toggleAppBar: () => {
    const next = !get().showAppBar;
    set({ showAppBar: next });
    config.saveConfig({ showAppBar: next });
  },

  toggleDirectoryPanel: () => {
    const next = !get().showDirectoryPanel;
    set({ showDirectoryPanel: next, showAppBar: next ? get().showAppBar : false });
    config.saveConfig({ showDirectoryPanel: next, showAppBar: next ? get().showAppBar : false });
  },

  toggleHideElementBorders: () => {
    const next = !get().hideElementBorders;
    applyMinimalStyle(next);
    set({ hideElementBorders: next });
    config.saveConfig({ hideElementBorders: next });
  },

  initApp: async () => {
    let workspacePath = config.getBootstrappedWorkspacePath();
    if (workspacePath === undefined) {
      workspacePath = await config.bootstrapApplication();
    }

    if (workspacePath) {
      await config.prepareWorkspace(normalizePath(workspacePath));
    }

    const cfg = await config.loadConfig();

    const colorThemeId = isColorThemeId(cfg.colorThemeId) ? cfg.colorThemeId : 'default';
    applyTheme(colorThemeId, cfg.isDarkTheme);
    applyMinimalStyle(cfg.hideElementBorders ?? false);
    document.documentElement.style.zoom = (cfg.zoomLevel ?? 1).toString();
    document.documentElement.style.setProperty('--zoom', (cfg.zoomLevel ?? 1).toString());

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('tinynote-storagePath');
    }

    if (workspacePath) {
      const normalizedStoragePath = normalizePath(workspacePath);
      set({ storagePath: normalizedStoragePath });
      let spaces = await fs.loadSpaces(normalizedStoragePath);
      let activeCfg = cfg;
      if (needsSpaceConfigInit(spaces, activeCfg.spaceOrder)) {
        const { spaceOrder, spaceIcons } = initializeSpaceConfig(spaces, activeCfg.spaceIcons);
        activeCfg = await config.saveConfig({ spaceOrder, spaceIcons });
      }
      spaces = applyIconsToSpaces(spaces, activeCfg.spaceIcons);
      spaces = sortSpacesByOrder(spaces, activeCfg.spaceOrder);

      let currentSpace: Space | null = null;
      let currentGroup: Group | null = null;
      let currentNotebook: Notebook | null = null;

      if (cfg.currentSpacePath) {
        currentSpace = spaces.find((s) => normalizePath(s.path) === normalizePath(cfg.currentSpacePath!)) || null;
      }
      if (!currentSpace && spaces.length > 0) {
        currentSpace = spaces[0];
      }

      if (currentSpace) {
        let children = await fs.loadSpaceChildren(currentSpace.path);
        children = sortTreeRecursively(children, cfg.groupOrder, currentSpace.path);
        const updatedSpace = { ...currentSpace, groups: children };
        currentSpace = updatedSpace;

        if (cfg.currentGroupPath) {
          currentGroup = findGroupByPath(children, cfg.currentGroupPath);
        }
        if (cfg.currentNotebookPath) {
          const found = findNotebookByPath(children, cfg.currentNotebookPath);
          if (found) {
            const loaded = await fs.loadNotebook(found.path);
            if (loaded) currentNotebook = loaded;
          }
        }

        const expandedPaths = cfg.expandedGroupPaths.map(normalizePath);
        const targetPath = cfg.currentNotebookPath || cfg.currentGroupPath;
        if (targetPath) {
          const ancestors = getAncestorPaths(children, targetPath);
          for (const p of ancestors) {
            const normalizedAncestor = normalizePath(p);
            if (!expandedPaths.includes(normalizedAncestor)) expandedPaths.push(normalizedAncestor);
          }
        }

        set({
          spaces,
          currentSpace,
          currentGroup,
          currentNotebook,
          currentNoteBlock: null,
          expandedGroupPaths: expandedPaths,
          recentNotebookHistory: cfg.recentNotebookHistory ?? [],
          zoomLevel: cfg.zoomLevel ?? 1,
          isDarkTheme: cfg.isDarkTheme,
          colorThemeId,
          isSidebarCollapsed: cfg.isSidebarCollapsed,
          showAppBar: cfg.showAppBar ?? true,
          showDirectoryPanel: cfg.showDirectoryPanel ?? true,
          hideElementBorders: cfg.hideElementBorders ?? false,
          viewMode: cfg.viewMode as ViewMode,
        });
      } else {
        set({
          spaces,
          recentNotebookHistory: cfg.recentNotebookHistory ?? [],
          zoomLevel: cfg.zoomLevel ?? 1,
          isDarkTheme: cfg.isDarkTheme,
          colorThemeId,
          isSidebarCollapsed: cfg.isSidebarCollapsed,
          showAppBar: cfg.showAppBar ?? true,
          showDirectoryPanel: cfg.showDirectoryPanel ?? true,
          hideElementBorders: cfg.hideElementBorders ?? false,
          viewMode: cfg.viewMode as ViewMode,
        });
      }
    } else {
      set({
        recentNotebookHistory: cfg.recentNotebookHistory ?? [],
        zoomLevel: cfg.zoomLevel ?? 1,
        isDarkTheme: cfg.isDarkTheme,
        colorThemeId,
        isSidebarCollapsed: cfg.isSidebarCollapsed,
        showAppBar: cfg.showAppBar ?? true,
        showDirectoryPanel: cfg.showDirectoryPanel ?? true,
        hideElementBorders: cfg.hideElementBorders ?? false,
        viewMode: cfg.viewMode as ViewMode,
      });
    }
  },

  selectSpace: async (space) => {
    const children = await fs.loadSpaceChildren(space.path);
    const cfg = config.getConfig();
    const sortedChildren = sortTreeRecursively(children, cfg.groupOrder, space.path);
    const updatedSpace = { ...space, groups: sortedChildren };
    set((state) => ({
      currentSpace: updatedSpace,
      currentGroup: null,
      currentNotebook: null,
      currentNoteBlock: null,
      spaces: state.spaces.map((s) => s.id === space.id ? updatedSpace : s),
    }));
    config.saveConfig({
      currentSpacePath: space.path,
      currentGroupPath: null,
      currentNotebookPath: null,
    });
  },

  selectGroup: async (group: Group) => {
    set({ currentGroup: group, currentNotebook: null, currentNoteBlock: null });
    config.saveConfig({ currentGroupPath: group.path, currentNotebookPath: null });
  },

  selectNotebook: async (notebook: Notebook) => {
    const loaded = await fs.loadNotebook(notebook.path);
    if (loaded) {
      const spacePath = get().currentSpace?.path;
      const nextHistory = spacePath ? [
        { path: notebook.path, name: loaded.name, spacePath, openedAt: new Date().toISOString() },
        ...get().recentNotebookHistory.filter((item) => normalizePath(item.path) !== normalizePath(notebook.path)),
      ].slice(0, 100) : get().recentNotebookHistory;
      set({ currentNotebook: loaded, currentNoteBlock: null, recentNotebookHistory: nextHistory });
      config.saveConfig({ currentNotebookPath: notebook.path, recentNotebookHistory: nextHistory });
    }
  },

  selectRecentNotebook: async (historyItem) => {
    let currentSpace = get().currentSpace;
    if (!currentSpace || normalizePath(currentSpace.path) !== normalizePath(historyItem.spacePath)) {
      const targetSpace = get().spaces.find((space) => normalizePath(space.path) === normalizePath(historyItem.spacePath));
      if (!targetSpace) return;
      await get().selectSpace(targetSpace);
      currentSpace = get().currentSpace;
    }
    if (!currentSpace) return;

    const notebook = findNotebookByPath(currentSpace.groups, historyItem.path);
    if (!notebook) return;

    const expandedGroupPaths = [...get().expandedGroupPaths];
    for (const path of getAncestorPaths(currentSpace.groups, historyItem.path)) {
      if (!expandedGroupPaths.some((item) => normalizePath(item) === normalizePath(path))) {
        expandedGroupPaths.push(path);
      }
    }
    set({ expandedGroupPaths });
    config.saveConfig({ expandedGroupPaths });
    await get().selectNotebook(notebook);
  },

  navigateToGlobalSearchResult: async (result) => {
    const state = get();
    const space = state.spaces.find((s) => normalizePath(s.path) === normalizePath(result.spacePath));
    if (!space) return;

    if (!state.currentSpace || normalizePath(state.currentSpace.path) !== normalizePath(result.spacePath)) {
      await get().selectSpace(space);
    }

    if (result.type === 'space') return;

    const currentSpace = get().currentSpace;
    if (!currentSpace || !result.notebookPath) return;

    const notebookInTree = findNotebookByPath(currentSpace.groups, result.notebookPath);
    if (!notebookInTree) return;

    const ancestors = getAncestorPaths(currentSpace.groups, result.notebookPath);
    const expandedGroupPaths = [...get().expandedGroupPaths];
    for (const p of ancestors) {
      if (!expandedGroupPaths.some((ep) => normalizePath(ep) === normalizePath(p))) {
        expandedGroupPaths.push(p);
      }
    }
    set({ expandedGroupPaths });
    config.saveConfig({ expandedGroupPaths });

    await get().selectNotebook(notebookInTree);

    if (result.type === 'noteBlock' && result.blockTitleKey) {
      const loaded = get().currentNotebook;
      const block = loaded?.noteBlocks.find((b) => b.title === result.blockTitleKey);
      if (block) {
        set({ currentNoteBlock: block });
      }
    }
  },

  toggleExpandedGroupPath: (path: string) => {
    set((state) => {
      const normalizedPath = normalizePath(path);
      const paths = state.expandedGroupPaths;
      const isExpanded = paths.some((p) => normalizePath(p) === normalizedPath);
      const nextPaths = isExpanded
        ? paths.filter((p) => normalizePath(p) !== normalizedPath)
        : [...paths, normalizedPath];
      return { expandedGroupPaths: nextPaths };
    });
    const { expandedGroupPaths } = get();
    config.saveConfig({ expandedGroupPaths });
  },

  expandAllGroups: () => {
    const { currentSpace } = get();
    if (!currentSpace) return;
    const allGroupPaths: string[] = [];
    const collect = (items: (Group | Notebook)[]) => {
      for (const item of items) {
        if ('children' in item) {
          allGroupPaths.push(item.path);
          collect(item.children);
        }
      }
    };
    collect(currentSpace.groups);
    set({ expandedGroupPaths: allGroupPaths });
    config.saveConfig({ expandedGroupPaths: allGroupPaths });
  },

  collapseAllGroups: () => {
    set({ expandedGroupPaths: [] });
    config.saveConfig({ expandedGroupPaths: [] });
  },

  addSpace: async (name) => {
    const { storagePath, spaces } = get();
    if (!storagePath) return;
    const space = await fs.createSpace(storagePath, name);
    const cfg = config.getConfig();
    const usedIcons = new Set(Object.values(cfg.spaceIcons));
    const icon = pickRandomSpaceIcon(usedIcons);
    const spaceWithIcon = { ...space, icon };
    const newSpaces = [...spaces, spaceWithIcon];
    set({
      spaces: newSpaces,
      currentSpace: spaceWithIcon,
      currentGroup: null,
      currentNotebook: null,
      currentNoteBlock: null,
    });
    config.saveConfig({
      currentSpacePath: space.path,
      currentGroupPath: null,
      currentNotebookPath: null,
      spaceIcons: { ...cfg.spaceIcons, [space.path]: icon },
      spaceOrder: newSpaces.map((s) => s.path),
    });
  },

  deleteSpace: async (space) => {
    await fs.deleteSpace(space.path);
    const newSpaces = get().spaces.filter((s) => s.id !== space.id);
    const isCurrentSpace = get().currentSpace?.id === space.id;
    set((state) => ({
      spaces: newSpaces,
      currentSpace: isCurrentSpace ? null : state.currentSpace,
      currentGroup: isCurrentSpace ? null : state.currentGroup,
      currentNotebook: isCurrentSpace ? null : state.currentNotebook,
      currentNoteBlock: isCurrentSpace ? null : state.currentNoteBlock,
    }));
    config.saveConfig({ spaceOrder: newSpaces.map((s) => s.path) });
    if (isCurrentSpace) {
      config.saveConfig({ currentSpacePath: null, currentGroupPath: null, currentNotebookPath: null });
    }
  },

  renameSpace: async (space, newName) => {
    const newPath = await fs.renameSpace(space.path, newName);
    const updatedSpace = { ...space, name: newName, path: newPath };
    set((state) => ({
      spaces: state.spaces.map((s) => s.id === space.id ? updatedSpace : s),
      currentSpace: state.currentSpace?.id === space.id ? updatedSpace : state.currentSpace,
    }));
    const cfg = config.getConfig();
    const newIcons = { ...cfg.spaceIcons };
    if (newIcons[space.path]) {
      newIcons[newPath] = newIcons[space.path];
      delete newIcons[space.path];
    }
    const newOrder = get().spaces.map((s) => s.id === space.id ? newPath : s.path);
    const updatedConfig: Partial<config.AppConfig> = { spaceIcons: newIcons, spaceOrder: newOrder };
    if (cfg.currentSpacePath === space.path) {
      updatedConfig.currentSpacePath = newPath;
    }
    config.saveConfig(updatedConfig);
  },

  updateSpaceIcon: async (_space, icon) => {
    const allSpaces = get().spaces;
    const space = allSpaces.find((s) => s.id === _space.id) || _space;
    const updatedSpace = { ...space, icon };
    set((state) => ({
      spaces: state.spaces.map((s) => s.id === space.id ? updatedSpace : s),
      currentSpace: state.currentSpace?.id === space.id ? updatedSpace : state.currentSpace,
    }));
    config.saveConfig({ spaceIcons: { ...config.getConfig().spaceIcons, [space.path]: icon } });
  },

  reorderSpaces: async (fromIndex, toIndex) => {
    set((state) => {
      const spaces = [...state.spaces];
      const [moved] = spaces.splice(fromIndex, 1);
      spaces.splice(toIndex, 0, moved);
      return { spaces };
    });
    const { spaces } = get();
    config.saveConfig({ spaceOrder: spaces.map((s) => s.path) });
  },

  addGroup: async (parentPath, name) => {
    const group = await fs.createGroup(parentPath, name);
    const { currentSpace } = get();
    if (currentSpace) {
      const isDirectChild = parentPath === currentSpace.path;
      const addGroupToChildren = (children: (Group | Notebook)[]): (Group | Notebook)[] => {
        return children.map((child) => {
          if ('children' in child && child.path === parentPath) {
            return { ...child, children: [...child.children, group], notebookCount: child.notebookCount + group.notebookCount };
          }
          if ('children' in child) {
            return { ...child, children: addGroupToChildren(child.children) };
          }
          return child;
        });
      };
      const updatedGroups = isDirectChild
        ? [...currentSpace.groups, group]
        : addGroupToChildren(currentSpace.groups);
      const updatedSpace = { ...currentSpace, groups: updatedGroups };
      set((state) => ({
        currentSpace: updatedSpace,
        spaces: state.spaces.map((s) => s.id === currentSpace.id ? updatedSpace : s),
      }));
      config.saveConfig({ groupOrder: { ...config.getConfig().groupOrder, [currentSpace.path]: updatedGroups.map((g) => g.path) } });
    }
  },

  deleteGroup: async (group) => {
    await fs.deleteGroup(group.path);
    const { currentSpace } = get();
    if (currentSpace) {
      const removeGroup = (children: (Group | Notebook)[]): (Group | Notebook)[] => {
        return children
          .filter((child) => !('children' in child && child.id === group.id) && !(child.path === group.path))
          .map((child) => {
            if ('children' in child) {
              return { ...child, children: removeGroup(child.children) };
            }
            return child;
          });
      };
      const updatedGroups = removeGroup(currentSpace.groups);
      const updatedSpace = { ...currentSpace, groups: updatedGroups };
      set((state) => ({
        currentSpace: updatedSpace,
        currentGroup: currentSpace.groups.some((item) => 'children' in item && item.id === group.id) ? null : get().currentGroup,
        spaces: state.spaces.map((s) => s.id === currentSpace.id ? updatedSpace : s),
      }));
    }
  },

  renameGroup: async (group, newName) => {
    const newPath = await fs.renameGroup(group.path, newName);
    const { currentSpace } = get();
    if (currentSpace) {
      const renameInTree = (children: (Group | Notebook)[]): (Group | Notebook)[] => {
        return children.map((child) => {
          if ('children' in child && child.id === group.id) {
            return { ...child, name: newName, path: newPath };
          }
          if ('children' in child) {
            return { ...child, children: renameInTree(child.children) };
          }
          return child;
        });
      };
      const isDirectChild = currentSpace.groups.some((g) => 'children' in g && g.id === group.id);
      const updatedGroups = isDirectChild
        ? currentSpace.groups.map((item) => 'children' in item && item.id === group.id ? { ...item, name: newName, path: newPath } : item)
        : renameInTree(currentSpace.groups);
      const updatedSpace = { ...currentSpace, groups: updatedGroups };
      const updatedCurrentGroup = get().currentGroup?.id === group.id
        ? { ...get().currentGroup!, name: newName, path: newPath }
        : get().currentGroup;
      set((state) => ({
        currentSpace: updatedSpace,
        currentGroup: updatedCurrentGroup,
        spaces: state.spaces.map((s) => s.id === currentSpace.id ? updatedSpace : s),
      }));
      const cfg = config.getConfig();
      const newGroupOrder = { ...cfg.groupOrder };
      const order = newGroupOrder[currentSpace.path];
      if (order) {
        newGroupOrder[currentSpace.path] = order.map((p) => p === group.path ? newPath : p);
      }
      const updatedConfig: Partial<config.AppConfig> = { groupOrder: newGroupOrder };
      if (cfg.currentGroupPath === group.path) {
        updatedConfig.currentGroupPath = newPath;
      }
      const expandedPaths = get().expandedGroupPaths.map((p) => p === group.path ? newPath : p);
      updatedConfig.expandedGroupPaths = expandedPaths;
      config.saveConfig(updatedConfig);
    }
  },

  addNotebook: async (parentPath, name) => {
    const notebook = await fs.createNotebook(parentPath, name);
    const { currentSpace } = get();
    if (currentSpace) {
      const addNotebookToTree = (children: (Group | Notebook)[]): (Group | Notebook)[] => {
        return children.map((child) => {
          if (child.path === parentPath && 'children' in child) {
            return {
              ...child,
              children: [...child.children, notebook],
              notebookCount: child.notebookCount + 1,
            };
          }
          if ('children' in child) {
            return { ...child, children: addNotebookToTree(child.children) };
          }
          return child;
        });
      };
      const isDirectChild = parentPath === currentSpace.path;
      const updatedGroups = isDirectChild
        ? [...currentSpace.groups, notebook]
        : currentSpace.groups.map((item) => {
            if ('children' in item && item.path === parentPath) {
              return { ...item, children: [...item.children, notebook], notebookCount: item.notebookCount + 1 };
            }
            if ('children' in item) {
              return { ...item, children: addNotebookToTree(item.children) };
            }
            return item;
          });
      const updatedSpace = { ...currentSpace, groups: updatedGroups };
      set((state) => ({
        currentSpace: updatedSpace,
        spaces: state.spaces.map((s) => s.id === currentSpace.id ? updatedSpace : s),
      }));
      config.saveConfig({ groupOrder: { ...config.getConfig().groupOrder, [currentSpace.path]: updatedGroups.map((g) => g.path) } });
    }
  },

  duplicateNotebook: async (notebook) => {
    const duplicated = await fs.duplicateNotebook(notebook.path);
    const parentPath = dirname(notebook.path);
    const { currentSpace } = get();
    if (currentSpace) {
      const insertAfterNotebook = (
        children: (Group | Notebook)[]
      ): { children: (Group | Notebook)[]; inserted: boolean } => {
        let inserted = false;
        const result: (Group | Notebook)[] = [];
        for (const child of children) {
          if (child.id === notebook.id) {
            result.push(child, duplicated);
            inserted = true;
          } else if ('children' in child) {
            const nested = insertAfterNotebook(child.children);
            if (nested.inserted) {
              result.push({ ...child, children: nested.children, notebookCount: child.notebookCount + 1 });
              inserted = true;
            } else {
              result.push(child);
            }
          } else {
            result.push(child);
          }
        }
        return { children: result, inserted };
      };
      const isDirectChild = normalizePath(parentPath) === normalizePath(currentSpace.path);
      let updatedGroups: (Group | Notebook)[];
      if (isDirectChild) {
        updatedGroups = insertAfterNotebook(currentSpace.groups).children;
      } else {
        updatedGroups = currentSpace.groups.map((item) => {
          if ('children' in item) {
            const nested = insertAfterNotebook(item.children);
            if (nested.inserted) {
              return { ...item, children: nested.children, notebookCount: item.notebookCount + 1 };
            }
          }
          return item;
        });
      }
      const updatedSpace = { ...currentSpace, groups: updatedGroups };
      set((state) => ({
        currentSpace: updatedSpace,
        spaces: state.spaces.map((s) => s.id === currentSpace.id ? updatedSpace : s),
      }));
      config.saveConfig({ groupOrder: { ...config.getConfig().groupOrder, [currentSpace.path]: updatedGroups.map((g) => g.path) } });
    }
    await get().selectNotebook(duplicated);
    return duplicated;
  },

  deleteNotebook: async (notebook) => {
    await fs.deleteNotebook(notebook.path);
    const { currentSpace } = get();
    if (currentSpace) {
      const removeNotebook = (children: (Group | Notebook)[]): (Group | Notebook)[] => {
        return children
          .filter((child) => !(child.id === notebook.id))
          .map((child) => {
            if ('children' in child) {
              return {
                ...child,
                children: removeNotebook(child.children),
                notebookCount: child.notebookCount - 1,
              };
            }
            return child;
          });
      };
      const updatedGroups = removeNotebook(currentSpace.groups);
      const updatedSpace = { ...currentSpace, groups: updatedGroups };
      set((state) => ({
        currentSpace: updatedSpace,
        currentNotebook: get().currentNotebook?.id === notebook.id ? null : get().currentNotebook,
        currentNoteBlock: get().currentNotebook?.id === notebook.id ? null : get().currentNoteBlock,
        spaces: state.spaces.map((s) => s.id === currentSpace.id ? updatedSpace : s),
      }));
    }
  },

  renameNotebook: async (notebook, newName) => {
    const newPath = await fs.renameNotebook(notebook.path, newName);
    const { currentSpace } = get();
    if (currentSpace) {
      const renameInTree = (children: (Group | Notebook)[]): (Group | Notebook)[] => {
        return children.map((child) => {
          if (child.id === notebook.id) {
            return { ...child, name: newName, path: newPath };
          }
          if ('children' in child) {
            return { ...child, children: renameInTree(child.children) };
          }
          return child;
        });
      };
      const updatedGroups = renameInTree(currentSpace.groups);
      const updatedSpace = { ...currentSpace, groups: updatedGroups };
      const updatedCurrentNotebook = get().currentNotebook?.id === notebook.id
        ? { ...get().currentNotebook!, name: newName, path: newPath }
        : get().currentNotebook;
      set((state) => ({
        currentSpace: updatedSpace,
        currentNotebook: updatedCurrentNotebook,
        spaces: state.spaces.map((s) => s.id === currentSpace.id ? updatedSpace : s),
      }));
      const cfg = config.getConfig();
      if (cfg.currentNotebookPath === notebook.path) {
        config.saveConfig({ currentNotebookPath: newPath });
      }
    }
  },

  addNoteBlock: async () => {
    const { currentNotebook } = get();
    if (!currentNotebook) return;
    const block = createNoteBlock();
    const updated = {
      ...currentNotebook,
      noteBlocks: [...currentNotebook.noteBlocks, block],
    };
    await fs.saveNotebook(updated);
    set({ currentNotebook: updated, currentNoteBlock: block });
  },

  addNoteBlockAtIndex: async (index: number) => {
    const { currentNotebook } = get();
    if (!currentNotebook) return;
    const block = createNoteBlock();
    const blocks = [...currentNotebook.noteBlocks];
    blocks.splice(index, 0, block);
    const updated = { ...currentNotebook, noteBlocks: blocks };
    await fs.saveNotebook(updated);
    set({ currentNotebook: updated, currentNoteBlock: block });
  },

  duplicateNoteBlock: async (id: string, index: number) => {
    const { currentNotebook } = get();
    if (!currentNotebook) return;
    const sourceBlock = currentNotebook.noteBlocks.find((b) => b.id === id);
    if (!sourceBlock) return;
    const now = new Date().toISOString();
    const duplicatedBlock: NoteBlock = {
      ...sourceBlock,
      id: crypto.randomUUID(),
      title: sourceBlock.title ? `${sourceBlock.title} 副本` : '副本',
      createdAt: now,
      updatedAt: now,
    };
    const blocks = [...currentNotebook.noteBlocks];
    blocks.splice(index, 0, duplicatedBlock);
    const updated = { ...currentNotebook, noteBlocks: blocks };
    await fs.saveNotebook(updated);
    set({ currentNotebook: updated, currentNoteBlock: duplicatedBlock });
  },

  pasteNoteBlock: async (block: NoteBlock, index: number) => {
    const { currentNotebook } = get();
    if (!currentNotebook) return;
    const now = new Date().toISOString();
    const newBlock: NoteBlock = {
      ...block,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const blocks = [...currentNotebook.noteBlocks];
    blocks.splice(index, 0, newBlock);
    const updated = { ...currentNotebook, noteBlocks: blocks };
    await fs.saveNotebook(updated);
    set({ currentNotebook: updated, currentNoteBlock: newBlock });
  },

  pasteNoteBlockAtEnd: async (block: NoteBlock) => {
    const { currentNotebook } = get();
    if (!currentNotebook) return;
    const now = new Date().toISOString();
    const newBlock: NoteBlock = {
      ...block,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const blocks = [...currentNotebook.noteBlocks, newBlock];
    const updated = { ...currentNotebook, noteBlocks: blocks };
    await fs.saveNotebook(updated);
    set({ currentNotebook: updated, currentNoteBlock: newBlock });
  },

  updateNoteBlock: async (id, updates) => {
    const { currentNotebook } = get();
    if (!currentNotebook) return;
    const updatedBlocks = currentNotebook.noteBlocks.map((b) =>
      b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
    );
    const updated = { ...currentNotebook, noteBlocks: updatedBlocks };
    await fs.saveNotebook(updated);
    const currentBlock = get().currentNoteBlock;
    set({
      currentNotebook: updated,
      currentNoteBlock: currentBlock?.id === id ? { ...currentBlock, ...updates, updatedAt: new Date().toISOString() } : currentBlock,
    });
  },

  deleteNoteBlock: async (id) => {
    const { currentNotebook } = get();
    if (!currentNotebook) return;
    const updatedBlocks = currentNotebook.noteBlocks.filter((b) => b.id !== id);
    const updated = { ...currentNotebook, noteBlocks: updatedBlocks };
    await fs.saveNotebook(updated);
    set({
      currentNotebook: updated,
      currentNoteBlock: get().currentNoteBlock?.id === id ? null : get().currentNoteBlock,
    });
  },

  reorderNoteBlocks: async (fromIndex, toIndex) => {
    const { currentNotebook } = get();
    if (!currentNotebook) return;
    const blocks = [...currentNotebook.noteBlocks];
    const [moved] = blocks.splice(fromIndex, 1);
    blocks.splice(toIndex, 0, moved);
    const updated = { ...currentNotebook, noteBlocks: blocks };
    await fs.saveNotebook(updated);
    set({ currentNotebook: updated });
  },

  reorderChildren: async (parentPath, fromIndex, toIndex) => {
    const { currentSpace } = get();
    if (!currentSpace) return;
    if (fromIndex === toIndex) return;

    const reorderInTree = (items: (Group | Notebook)[]): (Group | Notebook)[] => {
      if (parentPath === currentSpace.path) {
        const result = [...items];
        const [moved] = result.splice(fromIndex, 1);
        result.splice(toIndex, 0, moved);
        return result;
      }
      return items.map((item) => {
        if ('children' in item && item.path === parentPath) {
          const childResult = [...item.children];
          const [moved] = childResult.splice(fromIndex, 1);
          childResult.splice(toIndex, 0, moved);
          return { ...item, children: childResult } as Group;
        }
        if ('children' in item) {
          return { ...item, children: reorderInTree(item.children) } as Group;
        }
        return item;
      });
    };

    const newGroups = reorderInTree(currentSpace.groups);
    const updatedSpace = { ...currentSpace, groups: newGroups };

    set((state) => ({
      currentSpace: updatedSpace,
      spaces: state.spaces.map((s) => s.id === currentSpace.id ? updatedSpace : s),
    }));

    const cfg = config.getConfig();
    const newGroupOrder = { ...cfg.groupOrder };
    if (parentPath === currentSpace.path) {
      newGroupOrder[parentPath] = newGroups.map((c) => c.path);
    } else {
      const parentGroup = findGroupByPath(newGroups, parentPath);
      if (parentGroup) {
        newGroupOrder[parentPath] = parentGroup.children.map((c) => c.path);
      }
    }
    config.saveConfig({ groupOrder: newGroupOrder });
  },

  toggleSourceMode: () => {
    const { currentNotebook } = get();
    if (!currentNotebook) return;
    set({ currentNotebook: { ...currentNotebook, isSourceMode: !currentNotebook.isSourceMode } });
  },

  zoomIn: () => {
    const { zoomLevel } = get();
    const next = Math.min(2, Math.round((zoomLevel + 0.1) * 10) / 10);
    if (next !== zoomLevel) {
      set({ zoomLevel: next });
      document.documentElement.style.zoom = next.toString();
      document.documentElement.style.setProperty('--zoom', next.toString());
      config.saveConfig({ zoomLevel: next });
    }
  },

  zoomOut: () => {
    const { zoomLevel } = get();
    const next = Math.max(0.5, Math.round((zoomLevel - 0.1) * 10) / 10);
    if (next !== zoomLevel) {
      set({ zoomLevel: next });
      document.documentElement.style.zoom = next.toString();
      document.documentElement.style.setProperty('--zoom', next.toString());
      config.saveConfig({ zoomLevel: next });
    }
  },

  resetZoom: () => {
    const { zoomLevel } = get();
    if (zoomLevel !== 1) {
      set({ zoomLevel: 1 });
      document.documentElement.style.zoom = '1';
      document.documentElement.style.setProperty('--zoom', '1');
      config.saveConfig({ zoomLevel: 1 });
    }
  },

  moveItem: async (itemPath, itemKind, newParentPath) => {
    const { currentSpace, currentGroup, currentNotebook, expandedGroupPaths } = get();
    if (!currentSpace) return;

    if (itemKind === 'group') {
      const isDescendant = (parentPath: string, childPath: string): boolean => {
        return isSubPath(parentPath, childPath);
      };
      if (isDescendant(itemPath, newParentPath)) return;
    }

    const oldParentPath = dirname(itemPath);
    if (oldParentPath === newParentPath) return;

    let newPath: string;
    try {
      newPath = await fs.moveItem(itemPath, newParentPath);
    } catch (e) {
      console.error('[tinynote] Failed to move item:', e);
      return;
    }

    const children = await fs.loadSpaceChildren(currentSpace.path);
    const cfg = config.getConfig();
    const sortedChildren = sortTreeRecursively(children, cfg.groupOrder, currentSpace.path);
    const updatedSpace = { ...currentSpace, groups: sortedChildren };

    const updatePath = (oldBase: string, newBase: string, path: string): string => {
      const normalizedOldBase = normalizePath(oldBase);
      const normalizedNewBase = normalizePath(newBase);
      const normalizedPath = normalizePath(path);
      if (normalizedPath === normalizedOldBase) return normalizedNewBase;
      if (normalizedPath.startsWith(`${normalizedOldBase}/`)) {
        return normalizedNewBase + normalizedPath.substring(normalizedOldBase.length);
      }
      return path;
    };

    let updatedCurrentGroup = currentGroup;
    if (updatedCurrentGroup) {
      const updatedPath = updatePath(itemPath, newPath, updatedCurrentGroup.path);
      const found = findGroupByPath(sortedChildren, updatedPath);
      updatedCurrentGroup = found || null;
    }

    let updatedCurrentNotebook = currentNotebook;
    if (updatedCurrentNotebook) {
      const updatedPath = updatePath(itemPath, newPath, updatedCurrentNotebook.path);
      const found = findNotebookByPath(sortedChildren, updatedPath);
      if (found) {
        const loaded = await fs.loadNotebook(found.path);
        updatedCurrentNotebook = loaded || null;
      } else {
        updatedCurrentNotebook = null;
      }
    }

    const newExpandedPaths = expandedGroupPaths.map((p) => updatePath(itemPath, newPath, p));
    if (!newExpandedPaths.includes(newParentPath)) {
      newExpandedPaths.push(newParentPath);
    }

    set((state) => ({
      currentSpace: updatedSpace,
      currentGroup: updatedCurrentGroup,
      currentNotebook: updatedCurrentNotebook,
      currentNoteBlock: updatedCurrentNotebook ? state.currentNoteBlock : null,
      expandedGroupPaths: newExpandedPaths,
      spaces: state.spaces.map((s) => s.id === currentSpace.id ? updatedSpace : s),
    }));

    config.saveConfig({
      groupOrder: { ...cfg.groupOrder, [currentSpace.path]: sortedChildren.map((c) => c.path) },
      expandedGroupPaths: newExpandedPaths,
      currentGroupPath: updatedCurrentGroup?.path || cfg.currentGroupPath,
      currentNotebookPath: updatedCurrentNotebook?.path || cfg.currentNotebookPath,
    });
  },

  reloadSpaces: async () => {
    const { storagePath, currentSpace } = get();
    if (!storagePath) return;
    const cfg = config.getConfig();
    let spaces = await fs.loadSpaces(storagePath);
    spaces = applyIconsToSpaces(spaces, cfg.spaceIcons);
    spaces = sortSpacesByOrder(spaces, cfg.spaceOrder);

    if (currentSpace) {
      const freshSpace = spaces.find((s) => normalizePath(s.path) === normalizePath(currentSpace.path)) || null;
      if (freshSpace) {
        let children = await fs.loadSpaceChildren(freshSpace.path);
        children = sortTreeRecursively(children, cfg.groupOrder, freshSpace.path);
        const updatedSpace = { ...freshSpace, groups: children };

        let currentGroup = get().currentGroup;
        if (currentGroup) {
          const found = findGroupByPath(children, currentGroup.path);
          currentGroup = found || null;
        }

        let currentNotebook = get().currentNotebook;
        if (currentNotebook) {
          const found = findNotebookByPath(children, currentNotebook.path);
          if (found) {
            const loaded = await fs.loadNotebook(found.path);
            currentNotebook = loaded || null;
          } else {
            currentNotebook = null;
          }
        }

        set({
          spaces,
          currentSpace: updatedSpace,
          currentGroup,
          currentNotebook,
          currentNoteBlock: currentNotebook ? get().currentNoteBlock : null,
        });
      } else {
        set({ spaces, currentSpace: null, currentGroup: null, currentNotebook: null, currentNoteBlock: null });
      }
    } else {
      set({ spaces });
    }
  },
}));
