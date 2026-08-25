import { getStorageAdapter } from '@/adapters/storage';
import { basename, dirname, isSubPath, joinPath, normalizePath } from '@/utils/path';
import {
  detectNotebookFormat,
  getMatchedNotebookSuffix,
  getNotebookDisplayName,
  isMarkdownNotebookFileName,
  resolveImportedNotebookFileName,
  resolveNotebookFileName,
} from '@/utils/notebookFormat';
import { isNoteSpaceDirectoryName } from '@/utils/workspaceConfig';

function storage() {
  return getStorageAdapter();
}

export interface ImportNoteSource {
  /** Destination-relative path using `/`, e.g. `note.md` or `Folder/nested/note.md`. */
  relativePath: string;
  /** Identifies one picked directory so two folders with the same name stay separate. */
  groupId?: string;
  sourcePath?: string;
  readText: () => Promise<string>;
}

export interface ImportNotesResult {
  imported: number;
  converted: number;
  skipped: number;
}

function isHiddenPath(relativePath: string): boolean {
  return relativePath.split('/').some((segment) => segment.startsWith('.'));
}

function convertRelativePath(relativePath: string): { relativePath: string; converted: boolean } {
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length === 0) {
    return { relativePath, converted: false };
  }
  const resolved = resolveImportedNotebookFileName(parts[parts.length - 1]);
  parts[parts.length - 1] = resolved.fileName;
  return { relativePath: parts.join('/'), converted: resolved.converted };
}

async function allocateUniqueDirName(
  parentPath: string,
  name: string,
  taken: Set<string>,
): Promise<string> {
  let candidate = name;
  let n = 2;
  while (taken.has(candidate) || await storage().exists(joinPath(parentPath, candidate))) {
    candidate = `${name} (${n})`;
    n += 1;
  }
  taken.add(candidate);
  return candidate;
}

async function allocateUniqueFilePath(destPath: string): Promise<string> {
  if (!(await storage().exists(destPath))) return destPath;
  const parentPath = dirname(destPath);
  const fileName = basename(destPath);
  const format = detectNotebookFormat(fileName);
  const displayName = getNotebookDisplayName(fileName);
  const preserveExtension = format === 'unsupported'
    ? getMatchedNotebookSuffix(fileName)
    : undefined;
  let n = 2;
  while (true) {
    const nextName = resolveNotebookFileName(`${displayName} (${n})`, format, { preserveExtension }).fileName;
    const nextPath = joinPath(parentPath, nextName);
    if (!(await storage().exists(nextPath))) return nextPath;
    n += 1;
  }
}

async function walkMarkdownFiles(
  dirPath: string,
  relativePrefix: string,
): Promise<{ sourcePath: string; relativePath: string }[]> {
  let entries;
  try {
    entries = await storage().readDir(dirPath);
  } catch {
    return [];
  }

  const results: { sourcePath: string; relativePath: string }[] = [];
  for (const entry of entries) {
    if (!entry.name || entry.name.startsWith('.') || isNoteSpaceDirectoryName(entry.name)) continue;
    const childPath = joinPath(dirPath, entry.name);
    const childRelative = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory) {
      results.push(...await walkMarkdownFiles(childPath, childRelative));
    } else if (entry.isFile && isMarkdownNotebookFileName(entry.name)) {
      results.push({ sourcePath: childPath, relativePath: childRelative });
    }
  }
  return results;
}

export async function collectSourcesFromDroppedPaths(paths: string[]): Promise<ImportNoteSource[]> {
  const filePaths: string[] = [];
  const dirPaths: string[] = [];
  for (const path of paths) {
    try {
      const info = await storage().stat(path);
      if (info.isDirectory) dirPaths.push(path);
      else if (info.isFile) filePaths.push(path);
    } catch {
      // skip unreadable entries
    }
  }
  const sources = await collectSourcesFromFilePaths(filePaths);
  sources.push(...await collectSourcesFromDirectoryPaths(dirPaths));
  return sources;
}

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (success: (file: File) => void, error?: (err: DOMException) => void) => void;
  createReader?: () => {
    readEntries: (success: (entries: FileSystemEntryLike[]) => void, error?: (err: DOMException) => void) => void;
  };
}

function readFileEntry(entry: FileSystemEntryLike): Promise<File | null> {
  if (!entry.file) return Promise.resolve(null);
  return new Promise((resolve) => {
    entry.file!(resolve, () => resolve(null));
  });
}

function readDirectoryEntries(entry: FileSystemEntryLike): Promise<FileSystemEntryLike[]> {
  const reader = entry.createReader?.();
  if (!reader) return Promise.resolve([]);
  return new Promise((resolve) => {
    const collected: FileSystemEntryLike[] = [];
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(collected);
          return;
        }
        collected.push(...batch);
        readBatch();
      }, () => resolve(collected));
    };
    readBatch();
  });
}

async function collectSourcesFromFsEntry(
  entry: FileSystemEntryLike,
  parentRelative: string,
  groupId: string | undefined,
): Promise<ImportNoteSource[]> {
  if (!entry.name || entry.name.startsWith('.') || isNoteSpaceDirectoryName(entry.name)) return [];

  if (entry.isFile) {
    const file = await readFileEntry(entry);
    if (!file || !isMarkdownNotebookFileName(file.name)) return [];
    const relativePath = parentRelative ? `${parentRelative}/${file.name}` : file.name;
    if (isHiddenPath(relativePath)) return [];
    return [{
      relativePath,
      groupId: parentRelative ? groupId : undefined,
      readText: () => file.text(),
    }];
  }

  if (entry.isDirectory) {
    const relative = parentRelative ? `${parentRelative}/${entry.name}` : entry.name;
    const nextGroupId = groupId ?? relative;
    const children = await readDirectoryEntries(entry);
    const sources: ImportNoteSource[] = [];
    for (const child of children) {
      sources.push(...await collectSourcesFromFsEntry(child, relative, nextGroupId));
    }
    return sources;
  }

  return [];
}

export async function collectSourcesFromDataTransfer(dataTransfer: DataTransfer): Promise<ImportNoteSource[]> {
  const items = Array.from(dataTransfer.items ?? []);
  const sources: ImportNoteSource[] = [];
  let usedEntries = false;

  for (const item of items) {
    if (item.kind !== 'file') continue;
    const entry = (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntryLike | null }).webkitGetAsEntry?.();
    if (!entry) continue;
    usedEntries = true;
    sources.push(...await collectSourcesFromFsEntry(entry, '', undefined));
  }

  if (usedEntries) return sources;
  return collectSourcesFromBrowserFiles(Array.from(dataTransfer.files ?? []), 'files');
}

export async function collectSourcesFromFilePaths(filePaths: string[]): Promise<ImportNoteSource[]> {
  const sources: ImportNoteSource[] = [];
  for (const filePath of filePaths) {
    const normalized = normalizePath(filePath);
    const fileName = basename(normalized);
    if (!isMarkdownNotebookFileName(fileName) || fileName.startsWith('.')) continue;
    sources.push({
      relativePath: fileName,
      sourcePath: normalized,
      readText: () => storage().readTextFile(normalized),
    });
  }
  return sources;
}

export async function collectSourcesFromDirectoryPaths(dirPaths: string[]): Promise<ImportNoteSource[]> {
  const sources: ImportNoteSource[] = [];
  for (const dirPath of dirPaths) {
    const normalized = normalizePath(dirPath);
    const dirName = basename(normalized);
    if (!dirName || dirName.startsWith('.') || isNoteSpaceDirectoryName(dirName)) continue;
    const files = await walkMarkdownFiles(normalized, dirName);
    for (const file of files) {
      sources.push({
        relativePath: file.relativePath,
        groupId: normalized,
        sourcePath: file.sourcePath,
        readText: () => storage().readTextFile(file.sourcePath),
      });
    }
  }
  return sources;
}

export function collectSourcesFromBrowserFiles(
  files: File[],
  mode: 'files' | 'directories',
): ImportNoteSource[] {
  const sources: ImportNoteSource[] = [];
  for (const file of files) {
    if (!isMarkdownNotebookFileName(file.name)) continue;
    const relativePath = mode === 'directories'
      ? ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replace(/\\/g, '/')
      : file.name;
    if (isHiddenPath(relativePath)) continue;
    if (relativePath.split('/').some((segment) => isNoteSpaceDirectoryName(segment))) continue;
    const rootSegment = relativePath.split('/').filter(Boolean)[0] ?? file.name;
    sources.push({
      relativePath,
      groupId: mode === 'directories' ? rootSegment : undefined,
      readText: () => file.text(),
    });
  }
  return sources;
}

export async function importNotesToSpaceRoot(
  spacePath: string,
  sources: ImportNoteSource[],
): Promise<ImportNotesResult> {
  const destRoot = normalizePath(spacePath);
  const result: ImportNotesResult = { imported: 0, converted: 0, skipped: 0 };
  const groupRootMap = new Map<string, string>();
  const takenRoots = new Set<string>();

  for (const source of sources) {
    if (!isMarkdownNotebookFileName(basename(source.relativePath))) {
      result.skipped += 1;
      continue;
    }

    const converted = convertRelativePath(source.relativePath);
    let destRelative = converted.relativePath;
    const parts = destRelative.split('/').filter(Boolean);
    if (parts.length === 0 || parts.includes('..')) {
      result.skipped += 1;
      continue;
    }

    if (source.groupId && parts.length > 1) {
      let uniqueRoot = groupRootMap.get(source.groupId);
      if (!uniqueRoot) {
        uniqueRoot = await allocateUniqueDirName(destRoot, parts[0], takenRoots);
        groupRootMap.set(source.groupId, uniqueRoot);
      }
      parts[0] = uniqueRoot;
      destRelative = parts.join('/');
    }

    const destPath = await allocateUniqueFilePath(joinPath(destRoot, destRelative));
    if (source.sourcePath && normalizePath(source.sourcePath) === normalizePath(destPath)) {
      result.skipped += 1;
      continue;
    }
    if (source.sourcePath && isSubPath(destPath, source.sourcePath) && destPath !== normalizePath(source.sourcePath)) {
      result.skipped += 1;
      continue;
    }

    try {
      const parentDir = dirname(destPath);
      if (parentDir && parentDir !== destRoot) {
        await storage().mkdir(parentDir, true);
      }
      const content = await source.readText();
      await storage().writeTextFile(destPath, content);
      result.imported += 1;
      if (converted.converted) result.converted += 1;
    } catch (error) {
      console.error('[tinynote] Failed to import note:', source.relativePath, error);
      result.skipped += 1;
    }
  }

  return result;
}

export async function pickMarkdownFiles(): Promise<string[]> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function pickDirectories(): Promise<string[]> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    multiple: true,
    directory: true,
    recursive: true,
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}
