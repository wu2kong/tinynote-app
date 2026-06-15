import { readDir, readTextFile, writeTextFile, mkdir, remove, rename, exists } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { Space, Group, Notebook } from '@/types';
import { parseNoteBlocks, serializeNoteBlocks } from './noteParser';
import { basename, dirname, joinPath, normalizePath } from './path';

export async function selectStoragePath(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    recursive: true,
  });
  return selected ? normalizePath(selected as string) : null;
}

export async function loadSpaces(storagePath: string): Promise<Space[]> {
  const rootPath = normalizePath(storagePath);
  const spaces: Space[] = [];
  let entries;
  try {
    entries = await readDir(rootPath);
  } catch {
    return spaces;
  }

  for (const entry of entries) {
    if (entry.isDirectory && entry.name?.endsWith('.tinynotes')) {
      const spacePath = joinPath(rootPath, entry.name);
      const name = entry.name.replace('.tinynotes', '');
      const children = await loadSpaceChildren(spacePath);
      spaces.push({
        id: crypto.randomUUID(),
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
    entries = await readDir(parentPath);
  } catch {
    return children;
  }

  for (const entry of entries) {
    if (entry.isDirectory) {
      const groupPath = joinPath(parentPath, entry.name);
      const subChildren = await loadGroupChildren(groupPath);
      const notebookCount = countNotebooks(subChildren);
      children.push({
        id: crypto.randomUUID(),
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
    entries = await readDir(parentPath);
  } catch {
    return groups;
  }

  for (const entry of entries) {
    if (entry.isDirectory) {
      const groupPath = joinPath(parentPath, entry.name);
      const children = await loadGroupChildren(groupPath);
      const notebookCount = countNotebooks(children);
      groups.push({
        id: crypto.randomUUID(),
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
    entries = await readDir(parentPath);
  } catch {
    return children;
  }

  for (const entry of entries) {
    if (entry.isDirectory) {
      const subGroupPath = joinPath(parentPath, entry.name);
      const subChildren = await loadGroupChildren(subGroupPath);
      const notebookCount = countNotebooks(subChildren);
      children.push({
        id: crypto.randomUUID(),
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
    const content = await readTextFile(normalizedPath);
    const noteBlocks = parseNoteBlocks(content);
    const name = basename(normalizedPath).replace('.md', '');
    return {
      id: crypto.randomUUID(),
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
  await writeTextFile(notebook.path, content);
}

export async function createSpace(storagePath: string, name: string): Promise<Space> {
  const dirName = `${name}.tinynotes`;
  const spacePath = joinPath(storagePath, dirName);
  await mkdir(spacePath, { recursive: true });
  return {
    id: crypto.randomUUID(),
    name,
    path: spacePath,
    groups: [],
  };
}

export async function createGroup(parentPath: string, name: string): Promise<Group> {
  const groupPath = joinPath(parentPath, name);
  await mkdir(groupPath, { recursive: true });
  return {
    id: crypto.randomUUID(),
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
  await writeTextFile(filePath, initialContent);
  return {
    id: crypto.randomUUID(),
    name: name.replace('.md', ''),
    path: filePath,
    noteBlocks: [],
    isSourceMode: false,
  };
}

export async function duplicateNotebook(sourcePath: string): Promise<Notebook> {
  const normalizedSource = normalizePath(sourcePath);
  const parentPath = dirname(normalizedSource);
  const sourceName = basename(normalizedSource).replace(/\.md$/, '');
  const content = await readTextFile(normalizedSource);

  let copyName = `${sourceName} 副本`;
  let copyPath = joinPath(parentPath, `${copyName}.md`);
  let counter = 2;
  while (await exists(copyPath)) {
    copyName = `${sourceName} 副本 ${counter}`;
    copyPath = joinPath(parentPath, `${copyName}.md`);
    counter++;
  }

  await writeTextFile(copyPath, content);
  const notebook = await loadNotebook(copyPath);
  if (!notebook) {
    throw new Error('Failed to load duplicated notebook');
  }
  return notebook;
}

export async function renameSpace(oldPath: string, newName: string): Promise<string> {
  const parentPath = dirname(oldPath);
  const newPath = joinPath(parentPath, `${newName}.tinynotes`);
  await rename(oldPath, newPath);
  return newPath;
}

export async function deleteSpace(spacePath: string): Promise<void> {
  await remove(spacePath, { recursive: true });
}

export async function deleteGroup(groupPath: string): Promise<void> {
  await remove(groupPath, { recursive: true });
}

export async function deleteNotebook(filePath: string): Promise<void> {
  await remove(filePath);
}

export async function renameGroup(oldPath: string, newName: string): Promise<string> {
  const parentPath = dirname(oldPath);
  const newPath = joinPath(parentPath, newName);
  await rename(oldPath, newPath);
  return newPath;
}

export async function renameNotebook(oldPath: string, newName: string): Promise<string> {
  const parentPath = dirname(oldPath);
  const newFileName = newName.endsWith('.md') ? newName : `${newName}.md`;
  const newPath = joinPath(parentPath, newFileName);
  await rename(oldPath, newPath);
  return newPath;
}

export async function moveItem(oldPath: string, newParentPath: string): Promise<string> {
  const itemName = basename(oldPath);
  const newPath = joinPath(newParentPath, itemName);
  await rename(oldPath, newPath);
  return newPath;
}