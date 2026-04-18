import { useStore } from '@/store/useStore';
import { Space, Group, Notebook, NoteBlock } from '@/types';
import * as fs from '@/utils/fileSystem';

export function useFileSystem() {
  const store = useStore();

  const initApp = async () => {
    await store.initApp();
  };

  const selectStoragePath = async () => {
    const path = await fs.selectStoragePath();
    if (path) {
      store.setStoragePath(path);
      const spaces = await fs.loadSpaces(path);
      useStore.setState({ spaces });
    }
  };

  const selectSpace = async (space: Space) => {
    await store.selectSpace(space);
  };

  const selectGroup = async (group: Group) => {
    await store.selectGroup(group);
  };

  const selectNotebook = async (notebook: Notebook) => {
    await store.selectNotebook(notebook);
  };

  const addSpace = async (name: string) => {
    await store.addSpace(name);
  };

  const deleteSpace = async (space: Space) => {
    await store.deleteSpace(space);
  };

  const addGroup = async (parentPath: string, name: string) => {
    await store.addGroup(parentPath, name);
  };

  const deleteGroup = async (group: Group) => {
    await store.deleteGroup(group);
  };

  const addNotebook = async (parentPath: string, name: string) => {
    await store.addNotebook(parentPath, name);
  };

  const deleteNotebook = async (notebook: Notebook) => {
    await store.deleteNotebook(notebook);
  };

  const addNoteBlock = async () => {
    await store.addNoteBlock();
  };

  const updateNoteBlock = async (id: string, updates: Partial<NoteBlock>) => {
    await store.updateNoteBlock(id, updates);
  };

  const deleteNoteBlock = async (id: string) => {
    await store.deleteNoteBlock(id);
  };

  return {
    initApp,
    selectStoragePath,
    selectSpace,
    selectGroup,
    selectNotebook,
    addSpace,
    deleteSpace,
    addGroup,
    deleteGroup,
    addNotebook,
    deleteNotebook,
    addNoteBlock,
    updateNoteBlock,
    deleteNoteBlock,
  };
}