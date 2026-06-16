import { getStorageAdapter } from '@/adapters/storage';
import { Space, Group, Notebook } from '@/types';
import { parseNoteBlocks, serializeNoteBlocks } from './noteParser';
import { stableIdFromPath } from './stableId';
import { basename, dirname, joinPath, normalizePath } from './path';

function storage() {
  return getStorageAdapter();
}

export async function selectStoragePath(): Promise<string | null> {
  return storage().selectStoragePath();
}

export async function loadSpaces(storagePath: string): Promise<Space[]> {
  const rootPath = normalizePath(storagePath);
  const spaces: Space[] = [];
  let entries;
  try {
    entries = await storage().readDir(rootPath);
  } catch {
    return spaces;
  }

  for (const entry of entries) {
    if (entry.isDirectory && entry.name?.endsWith('.tinynotes')) {
      const spacePath = joinPath(rootPath, entry.name);
      const name = entry.name.replace('.tinynotes', '');
      const children = await loadSpaceChildren(spacePath);
      spaces.push({
        id: stableIdFromPath(spacePath),
        name,
        path: spacePath,
        groups: children,
      });
    }
  }

  return spaces;
}

export async function loadSpaceChildren(spacePath: string): Promise<(Group | Notebook)[]> {
  const parentPath = normalizePath(spacePath);
  const children: (Group | Notebook)[] = [];
  let entries;
  try {
    entries = await storage().readDir(parentPath);
  } catch {
    return children;
  }

  for (const entry of entries) {
    if (entry.isDirectory) {
      const groupPath = joinPath(parentPath, entry.name);
      const subChildren = await loadGroupChildren(groupPath);
      const notebookCount = countNotebooks(subChildren);
      children.push({
        id: stableIdFromPath(groupPath),
        name: entry.name,
        path: groupPath,
        children: subChildren,
        notebookCount,
      });
    } else if (entry.isFile && entry.name?.endsWith('.md')) {
      const filePath = joinPath(parentPath, entry.name);
      const notebook = await loadNotebook(filePath);
      if (notebook) {
        children.push(notebook);
      }
    }
  }

  return children;
}

export async function loadGroups(spacePath: string): Promise<Group[]> {
  const parentPath = normalizePath(spacePath);
  const groups: Group[] = [];
  let entries;
  try {
    entries = await storage().readDir(parentPath);
  } catch {
    return groups;
  }

  for (const entry of entries) {
    if (entry.isDirectory) {
      const groupPath = joinPath(parentPath, entry.name);
      const children = await loadGroupChildren(groupPath);
      const notebookCount = countNotebooks(children);
      groups.push({
        id: stableIdFromPath(groupPath),
        name: entry.name,
        path: groupPath,
        children,
        notebookCount,
      });
    }
  }

  return groups;
}

async function loadGroupChildren(groupPath: string): Promise<(Group | Notebook)[]> {
  const parentPath = normalizePath(groupPath);
  const children: (Group | Notebook)[] = [];
  let entries;
  try {
    entries = await storage().readDir(parentPath);
  } catch {
    return children;
  }

  for (const entry of entries) {
    if (entry.isDirectory) {
      const subGroupPath = joinPath(parentPath, entry.name);
      const subChildren = await loadGroupChildren(subGroupPath);
      const notebookCount = countNotebooks(subChildren);
      children.push({
        id: stableIdFromPath(subGroupPath),
        name: entry.name,
        path: subGroupPath,
        children: subChildren,
        notebookCount,
      });
    } else if (entry.isFile && entry.name?.endsWith('.md')) {
      const filePath = joinPath(parentPath, entry.name);
      const notebook = await loadNotebook(filePath);
      if (notebook) {
        children.push(notebook);
      }
    }
  }

  return children;
}

export function countSpaceNotebooks(space: Space): number {
  return countNotebooks(space.groups);
}

function countNotebooks(children: (Group | Notebook)[]): number {
  let count = 0;
  for (const child of children) {
    if ('noteBlocks' in child) {
      count += 1;
    } else {
      count += countNotebooks((child as Group).children);
    }
  }
  return count;
}

export async function loadNotebook(filePath: string): Promise<Notebook | null> {
  const normalizedPath = normalizePath(filePath);
  try {
    const content = await storage().readTextFile(normalizedPath);
    const noteBlocks = parseNoteBlocks(content, normalizedPath);
    const name = basename(normalizedPath).replace('.md', '');
    return {
      id: stableIdFromPath(normalizedPath),
      name,
      path: normalizedPath,
      noteBlocks,
      isSourceMode: false,
    };
  } catch {
    return null;
  }
}

export async function saveNotebook(notebook: Notebook): Promise<void> {
  const content = serializeNoteBlocks(notebook.noteBlocks);
  await storage().writeTextFile(notebook.path, content);
}

export async function createSpace(storagePath: string, name: string): Promise<Space> {
  const dirName = `${name}.tinynotes`;
  const spacePath = joinPath(storagePath, dirName);
  await storage().mkdir(spacePath, true);
  return {
    id: stableIdFromPath(spacePath),
    name,
    path: spacePath,
    groups: [],
  };
}

export async function createGroup(parentPath: string, name: string): Promise<Group> {
  const groupPath = joinPath(parentPath, name);
  await storage().mkdir(groupPath, true);
  return {
    id: stableIdFromPath(groupPath),
    name,
    path: groupPath,
    children: [],
    notebookCount: 0,
  };
}

export async function createNotebook(parentPath: string, name: string): Promise<Notebook> {
  const fileName = name.endsWith('.md') ? name : `${name}.md`;
  const filePath = joinPath(parentPath, fileName);
  const now = new Date().toISOString();
  const initialContent = `---\ntitle: ${name}\ntags: []\ncreatedAt: ${now}\nupdatedAt: ${now}\n---\n\n`;
  await storage().writeTextFile(filePath, initialContent);
  const notebook = await loadNotebook(filePath);
  if (!notebook) {
    throw new Error('Failed to load created notebook');
  }
  return notebook;
}

export async function duplicateNotebook(sourcePath: string): Promise<Notebook> {
  const normalizedSource = normalizePath(sourcePath);
  const parentPath = dirname(normalizedSource);
  const sourceName = basename(normalizedSource).replace(/\.md$/, '');
  const content = await storage().readTextFile(normalizedSource);

  let copyName = `${sourceName} 副本`;
  let copyPath = joinPath(parentPath, `${copyName}.md`);
  let counter = 2;
  while (await storage().exists(copyPath)) {
    copyName = `${sourceName} 副本 ${counter}`;
    copyPath = joinPath(parentPath, `${copyName}.md`);
    counter++;
  }

  await storage().writeTextFile(copyPath, content);
  const notebook = await loadNotebook(copyPath);
  if (!notebook) {
    throw new Error('Failed to load duplicated notebook');
  }
  return notebook;
}

export async function renameSpace(oldPath: string, newName: string): Promise<string> {
  const parentPath = dirname(oldPath);
  const newPath = joinPath(parentPath, `${newName}.tinynotes`);
  await storage().rename(oldPath, newPath);
  return newPath;
}

export async function deleteSpace(spacePath: string): Promise<void> {
  await storage().remove(spacePath, true);
}

export async function deleteGroup(groupPath: string): Promise<void> {
  await storage().remove(groupPath, true);
}

export async function deleteNotebook(filePath: string): Promise<void> {
  await storage().remove(filePath, false);
}

export async function renameGroup(oldPath: string, newName: string): Promise<string> {
  const parentPath = dirname(oldPath);
  const newPath = joinPath(parentPath, newName);
  await storage().rename(oldPath, newPath);
  return newPath;
}

export async function renameNotebook(oldPath: string, newName: string): Promise<string> {
  const parentPath = dirname(oldPath);
  const newFileName = newName.endsWith('.md') ? newName : `${newName}.md`;
  const newPath = joinPath(parentPath, newFileName);
  await storage().rename(oldPath, newPath);
  return newPath;
}

export async function moveItem(oldPath: string, newParentPath: string): Promise<string> {
  const itemName = basename(oldPath);
  const newPath = joinPath(newParentPath, itemName);
  await storage().rename(oldPath, newPath);
  return newPath;
}

export function getDefaultStoragePath(): string {
  return storage().defaultStoragePath;
}
