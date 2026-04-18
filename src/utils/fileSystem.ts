import { readDir, readTextFile, writeTextFile, mkdir, remove, rename } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { Space, Group, Notebook } from '@/types';
import { parseNoteBlocks, serializeNoteBlocks } from './noteParser';

export async function selectStoragePath(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false });
  return selected as string | null;
}

export async function loadSpaces(storagePath: string): Promise<Space[]> {
  const spaces: Space[] = [];
  let entries;
  try {
    entries = await readDir(storagePath);
  } catch {
    return spaces;
  }

  for (const entry of entries) {
    if (entry.isDirectory && entry.name?.endsWith('.tinynotes')) {
      const spacePath = `${storagePath}/${entry.name}`;
      const name = entry.name.replace('.tinynotes', '');
      const groups = await loadGroups(spacePath);
      spaces.push({
        id: crypto.randomUUID(),
        name,
        path: spacePath,
        groups,
      });
    }
  }

  return spaces;
}

export async function loadGroups(spacePath: string): Promise<Group[]> {
  const groups: Group[] = [];
  let entries;
  try {
    entries = await readDir(spacePath);
  } catch {
    return groups;
  }

  for (const entry of entries) {
    if (entry.isDirectory) {
      const groupPath = `${spacePath}/${entry.name}`;
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
  const children: (Group | Notebook)[] = [];
  let entries;
  try {
    entries = await readDir(groupPath);
  } catch {
    return children;
  }

  for (const entry of entries) {
    if (entry.isDirectory) {
      const subGroupPath = `${groupPath}/${entry.name}`;
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
      const filePath = `${groupPath}/${entry.name}`;
      const notebook = await loadNotebook(filePath);
      if (notebook) {
        children.push(notebook);
      }
    }
  }

  return children;
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
  try {
    const content = await readTextFile(filePath);
    const noteBlocks = parseNoteBlocks(content);
    const name = filePath.split('/').pop()!.replace('.md', '');
    return {
      id: crypto.randomUUID(),
      name,
      path: filePath,
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
  const spacePath = `${storagePath}/${dirName}`;
  await mkdir(spacePath, { recursive: true });
  return {
    id: crypto.randomUUID(),
    name,
    path: spacePath,
    groups: [],
  };
}

export async function createGroup(parentPath: string, name: string): Promise<Group> {
  const groupPath = `${parentPath}/${name}`;
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
  const filePath = `${parentPath}/${fileName}`;
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

export async function renameSpace(oldPath: string, newName: string): Promise<string> {
  const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
  const newPath = `${parentPath}/${newName}.tinynotes`;
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
  const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
  const newPath = `${parentPath}/${newName}`;
  await rename(oldPath, newPath);
  return newPath;
}

export async function renameNotebook(oldPath: string, newName: string): Promise<string> {
  const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
  const newFileName = newName.endsWith('.md') ? newName : `${newName}.md`;
  const newPath = `${parentPath}/${newFileName}`;
  await rename(oldPath, newPath);
  return newPath;
}