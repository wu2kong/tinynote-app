import { create } from 'zustand';
import { AppState, Space, Group, Notebook, NoteBlock, ViewMode } from '@/types';
import { applyTheme } from '@/utils/theme';
import * as fs from '@/utils/fileSystem';
import * as config from '@/utils/config';
import { createNoteBlock } from '@/utils/noteParser';

interface AppActions {
  setSpace: (space: Space | null) => void;
  setGroup: (group: Group | null) => void;
  setNotebook: (notebook: Notebook | null) => void;
  setNoteBlock: (block: NoteBlock | null) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setStoragePath: (path: string | null) => Promise<void>;
  initApp: () => Promise<void>;
  selectSpace: (space: Space) => Promise<void>;
  selectGroup: (group: Group) => Promise<void>;
  selectNotebook: (notebook: Notebook) => Promise<void>;
  addSpace: (name: string) => Promise<void>;
  deleteSpace: (space: Space) => Promise<void>;
  renameSpace: (space: Space, newName: string) => Promise<void>;
  updateSpaceIcon: (space: Space, icon: string) => Promise<void>;
  reorderSpaces: (fromIndex: number, toIndex: number) => Promise<void>;
  addGroup: (parentPath: string, name: string) => Promise<void>;
  deleteGroup: (group: Group) => Promise<void>;
  renameGroup: (group: Group, newName: string) => Promise<void>;
  addNotebook: (parentPath: string, name: string) => Promise<void>;
  deleteNotebook: (notebook: Notebook) => Promise<void>;
  renameNotebook: (notebook: Notebook, newName: string) => Promise<void>;
  addNoteBlock: () => Promise<void>;
  updateNoteBlock: (id: string, updates: Partial<NoteBlock>) => Promise<void>;
  deleteNoteBlock: (id: string) => Promise<void>;
  reorderNoteBlocks: (fromIndex: number, toIndex: number) => Promise<void>;
  toggleSourceMode: () => void;
  reloadSpaces: () => Promise<void>;
}

type AppStore = AppState & AppActions;

function sortSpacesByOrder(spaces: Space[], order: string[]): Space[] {
  if (order.length === 0) return spaces;
  const ordered: Space[] = [];
  const remaining = [...spaces];
  for (const path of order) {
    const idx = remaining.findIndex((s) => s.path === path);
    if (idx !== -1) {
      ordered.push(remaining.splice(idx, 1)[0]);
    }
  }
  return [...ordered, ...remaining];
}

function sortGroupsByOrder(groups: Group[], order: string[]): Group[] {
  if (order.length === 0) return groups;
  const ordered: Group[] = [];
  const remaining = [...groups];
  for (const path of order) {
    const idx = remaining.findIndex((g) => g.path === path);
    if (idx !== -1) {
      ordered.push(remaining.splice(idx, 1)[0]);
    }
  }
  return [...ordered, ...remaining];
}

function applyIconsToSpaces(spaces: Space[], icons: Record<string, string>): Space[] {
  return spaces.map((s) => ({
    ...s,
    icon: icons[s.path] || s.icon,
  }));
}

export const useStore = create<AppStore>((set, get) => ({
  spaces: [],
  currentSpace: null,
  currentGroup: null,
  currentNotebook: null,
  currentNoteBlock: null,
  isDarkTheme: false,
  isSidebarCollapsed: false,
  viewMode: 'list' as ViewMode,
  searchQuery: '',
  storagePath: null,

  setSpace: (space) => set({ currentSpace: space, currentGroup: null, currentNotebook: null, currentNoteBlock: null }),
  setGroup: (group) => set({ currentGroup: group, currentNotebook: null, currentNoteBlock: null }),
  setNotebook: (notebook) => set({ currentNotebook: notebook, currentNoteBlock: null }),
  setNoteBlock: (block) => set({ currentNoteBlock: block }),

  setViewMode: (mode) => {
    set({ viewMode: mode });
    config.saveConfig({ viewMode: mode });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setStoragePath: async (path) => {
    set({ storagePath: path });
    if (path) {
      await config.saveConfig({ storagePath: path });
    } else {
      await config.saveConfig({ storagePath: null });
    }
  },

  toggleTheme: () => {
    const next = !get().isDarkTheme;
    applyTheme(next);
    set({ isDarkTheme: next });
    config.saveConfig({ isDarkTheme: next });
  },

  toggleSidebar: () => {
    const next = !get().isSidebarCollapsed;
    set({ isSidebarCollapsed: next });
    config.saveConfig({ isSidebarCollapsed: next });
  },

  initApp: async () => {
    const cfg = await config.loadConfig();
    applyTheme(cfg.isDarkTheme);

    const storagePath = cfg.storagePath || localStorage.getItem('tinynote-storagePath');
    if (storagePath) {
      if (!cfg.storagePath && storagePath) {
        await config.saveConfig({ storagePath });
      }
      localStorage.removeItem('tinynote-storagePath');
      set({ storagePath });
      let spaces = await fs.loadSpaces(storagePath);
      spaces = applyIconsToSpaces(spaces, cfg.spaceIcons);
      spaces = sortSpacesByOrder(spaces, cfg.spaceOrder);
      const currentSpace = spaces.length > 0 ? spaces[0] : null;
      if (currentSpace) {
        let groups = await fs.loadGroups(currentSpace.path);
        const groupOrder = cfg.groupOrder[currentSpace.path];
        if (groupOrder) {
          groups = sortGroupsByOrder(groups, groupOrder);
        }
        const updatedSpace = { ...currentSpace, groups };
        set({
          spaces,
          currentSpace: updatedSpace,
          isDarkTheme: cfg.isDarkTheme,
          isSidebarCollapsed: cfg.isSidebarCollapsed,
          viewMode: cfg.viewMode as ViewMode,
        });
      } else {
        set({
          spaces,
          isDarkTheme: cfg.isDarkTheme,
          isSidebarCollapsed: cfg.isSidebarCollapsed,
          viewMode: cfg.viewMode as ViewMode,
        });
      }
    } else {
      set({
        isDarkTheme: cfg.isDarkTheme,
        isSidebarCollapsed: cfg.isSidebarCollapsed,
        viewMode: cfg.viewMode as ViewMode,
      });
    }
  },

  selectSpace: async (space) => {
    const groups = await fs.loadGroups(space.path);
    const cfg = config.getConfig();
    let sortedGroups = groups;
    const groupOrder = cfg.groupOrder[space.path];
    if (groupOrder) {
      sortedGroups = sortGroupsByOrder(groups, groupOrder);
    }
    const updatedSpace = { ...space, groups: sortedGroups };
    set((state) => ({
      currentSpace: updatedSpace,
      currentGroup: null,
      currentNotebook: null,
      currentNoteBlock: null,
      spaces: state.spaces.map((s) => s.id === space.id ? updatedSpace : s),
    }));
  },

  selectGroup: async (group: Group) => {
    set({ currentGroup: group, currentNotebook: null, currentNoteBlock: null });
  },

  selectNotebook: async (notebook: Notebook) => {
    const loaded = await fs.loadNotebook(notebook.path);
    if (loaded) {
      set({ currentNotebook: loaded, currentNoteBlock: null });
    }
  },

  addSpace: async (name) => {
    const { storagePath } = get();
    if (!storagePath) return;
    const space = await fs.createSpace(storagePath, name);
    set((state) => ({
      spaces: [...state.spaces, space],
      currentSpace: space,
      currentGroup: null,
      currentNotebook: null,
      currentNoteBlock: null,
    }));
  },

  deleteSpace: async (space) => {
    await fs.deleteSpace(space.path);
    const newSpaces = get().spaces.filter((s) => s.id !== space.id);
    set((state) => ({
      spaces: newSpaces,
      currentSpace: state.currentSpace?.id === space.id ? null : state.currentSpace,
      currentGroup: state.currentSpace?.id === space.id ? null : state.currentGroup,
      currentNotebook: state.currentSpace?.id === space.id ? null : state.currentNotebook,
      currentNoteBlock: state.currentSpace?.id === space.id ? null : state.currentNoteBlock,
    }));
    config.saveConfig({ spaceOrder: newSpaces.map((s) => s.path) });
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
    config.saveConfig({ spaceIcons: newIcons, spaceOrder: newOrder });
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
        ? [...currentSpace.groups, group] as Group[]
        : addGroupToChildren(currentSpace.groups) as Group[];
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
      const updatedGroups = removeGroup(currentSpace.groups) as Group[];
      const updatedSpace = { ...currentSpace, groups: updatedGroups };
      set((state) => ({
        currentSpace: updatedSpace,
        currentGroup: currentSpace.groups.find((g) => g.id === group.id) ? null : get().currentGroup,
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
      const isDirectChild = currentSpace.groups.some((g) => g.id === group.id);
      const updatedGroups = isDirectChild
        ? currentSpace.groups.map((g) => g.id === group.id ? { ...g, name: newName, path: newPath } : g) as Group[]
        : renameInTree(currentSpace.groups) as Group[];
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
      config.saveConfig({ groupOrder: newGroupOrder });
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
      const updatedGroups = (isDirectChild
        ? [...currentSpace.groups, notebook]
        : currentSpace.groups.map((g) => {
            if (g.path === parentPath) {
              return { ...g, children: [...g.children, notebook], notebookCount: g.notebookCount + 1 };
            }
            return { ...g, children: addNotebookToTree(g.children) };
          })) as Group[];
      const updatedSpace = { ...currentSpace, groups: updatedGroups };
      set((state) => ({
        currentSpace: updatedSpace,
        spaces: state.spaces.map((s) => s.id === currentSpace.id ? updatedSpace : s),
      }));
    }
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
      const updatedGroups = removeNotebook(currentSpace.groups) as Group[];
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
      const updatedGroups = renameInTree(currentSpace.groups) as Group[];
      const updatedSpace = { ...currentSpace, groups: updatedGroups };
      const updatedCurrentNotebook = get().currentNotebook?.id === notebook.id
        ? { ...get().currentNotebook!, name: newName, path: newPath }
        : get().currentNotebook;
      set((state) => ({
        currentSpace: updatedSpace,
        currentNotebook: updatedCurrentNotebook,
        spaces: state.spaces.map((s) => s.id === currentSpace.id ? updatedSpace : s),
      }));
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

  toggleSourceMode: () => {
    const { currentNotebook } = get();
    if (!currentNotebook) return;
    set({ currentNotebook: { ...currentNotebook, isSourceMode: !currentNotebook.isSourceMode } });
  },

  reloadSpaces: async () => {
    const { storagePath } = get();
    if (!storagePath) return;
    const cfg = config.getConfig();
    let spaces = await fs.loadSpaces(storagePath);
    spaces = applyIconsToSpaces(spaces, cfg.spaceIcons);
    spaces = sortSpacesByOrder(spaces, cfg.spaceOrder);
    set({ spaces });
  },
}));