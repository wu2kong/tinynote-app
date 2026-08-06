import 'dart:io';

import '../core/note_parser.dart';
import '../core/path_utils.dart';
import '../core/stable_id.dart';
import '../core/types.dart';
import '../core/workspace_config.dart';
import '../l10n/l10n.dart';
import '../storage/local_storage.dart';

int countNotebooks(List<LibraryItem> children) {
  var count = 0;
  for (final child in children) {
    if (child is NotebookItem) {
      count += 1;
    } else if (child is GroupItem) {
      count += countNotebooks(child.group.children);
    }
  }
  return count;
}

class FileSystemService {
  FileSystemService(this.storage);

  final LocalStorage storage;

  Future<List<Space>> loadSpaces(String storagePath) async {
    final rootPath = normalizePath(storagePath);
    final spaces = <Space>[];
    final entries = await storage.readDir(rootPath);

    for (final entry in entries) {
      if (entry is! Directory) continue;
      final name = basename(entry.path);
      if (!isNoteSpaceDirectoryName(name)) continue;

      final spacePath = joinPath(rootPath, name);
      final children = await loadFolderChildren(spacePath);
      spaces.add(
        Space(
          id: stableIdFromPath(spacePath),
          name: name.replaceAll('.tinynotes', ''),
          path: spacePath,
          groups: children,
        ),
      );
    }

    return spaces;
  }

  Future<List<LibraryItem>> loadFolderChildren(String folderPath) async {
    final parentPath = normalizePath(folderPath);
    final children = <LibraryItem>[];
    final entries = await storage.readDir(parentPath);

    for (final entry in entries) {
      if (entry is Directory) {
        final name = basename(entry.path);
        if (name == workspaceConfigDir) continue;
        final groupPath = joinPath(parentPath, name);
        final subChildren = await loadGroupChildren(groupPath);
        children.add(
          GroupItem(
            Group(
              id: stableIdFromPath(groupPath),
              name: name,
              path: groupPath,
              children: subChildren,
              notebookCount: countNotebooks(subChildren),
            ),
          ),
        );
      } else if (entry is File && entry.path.endsWith('.md')) {
        final notebook = await loadNotebook(entry.path);
        if (notebook != null) {
          children.add(NotebookItem(notebook));
        }
      }
    }

    return children;
  }

  Future<List<LibraryItem>> loadGroupChildren(String groupPath) async {
    final parentPath = normalizePath(groupPath);
    final children = <LibraryItem>[];
    final entries = await storage.readDir(parentPath);

    for (final entry in entries) {
      if (entry is Directory) {
        final name = basename(entry.path);
        final subGroupPath = joinPath(parentPath, name);
        final subChildren = await loadGroupChildren(subGroupPath);
        children.add(
          GroupItem(
            Group(
              id: stableIdFromPath(subGroupPath),
              name: name,
              path: subGroupPath,
              children: subChildren,
              notebookCount: countNotebooks(subChildren),
            ),
          ),
        );
      } else if (entry is File && entry.path.endsWith('.md')) {
        final notebook = await loadNotebook(entry.path);
        if (notebook != null) {
          children.add(NotebookItem(notebook));
        }
      }
    }

    return children;
  }

  Future<Notebook?> loadNotebook(String filePath) async {
    final normalizedPath = normalizePath(filePath);
    try {
      final content = await storage.readTextFile(normalizedPath);
      final noteBlocks = parseNoteBlocks(content, notebookPath: normalizedPath);
      final name = basename(normalizedPath).replaceAll('.md', '');
      return Notebook(
        id: stableIdFromPath(normalizedPath),
        name: name,
        path: normalizedPath,
        noteBlocks: noteBlocks,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> saveNotebook(Notebook notebook) async {
    final content = serializeNoteBlocks(notebook.noteBlocks);
    await storage.writeTextFile(notebook.path, content);
  }

  Future<Space> createSpace(String storagePath, String name) async {
    final spacePath = joinPath(storagePath, '$name.tinynotes');
    if (await storage.exists(spacePath)) {
      throw StateError(appStrings.fill(appStrings.spaceExists, {'name': name}));
    }
    await storage.mkdir(spacePath, recursive: true);
    return Space(
      id: stableIdFromPath(spacePath),
      name: name,
      path: spacePath,
      groups: const [],
    );
  }

  Future<Group> createGroup(String parentPath, String name) async {
    final groupPath = joinPath(parentPath, name);
    if (await storage.exists(groupPath)) {
      throw StateError(
        appStrings.fill(appStrings.folderExists, {'name': name}),
      );
    }
    await storage.mkdir(groupPath, recursive: true);
    return Group(
      id: stableIdFromPath(groupPath),
      name: name,
      path: groupPath,
      children: const [],
      notebookCount: 0,
    );
  }

  Future<Notebook> createNotebook(String parentPath, String name) async {
    final fileName = name.endsWith('.md') ? name : '$name.md';
    final filePath = joinPath(parentPath, fileName);
    if (await storage.exists(filePath)) {
      throw StateError(
        appStrings.fill(appStrings.notebookExists, {'name': name}),
      );
    }
    final now = DateTime.now().toUtc().toIso8601String();
    final initialContent =
        '---\n'
        'title: $name\n'
        'tags: []\n'
        'createdAt: $now\n'
        'updatedAt: $now\n'
        '---\n\n';
    await storage.writeTextFile(filePath, initialContent);
    final notebook = await loadNotebook(filePath);
    if (notebook == null) {
      throw StateError('Failed to load created notebook');
    }
    return notebook;
  }

  Future<String> renameSpace(String oldPath, String newName) async {
    final parentPath = dirname(oldPath);
    final newPath = joinPath(parentPath, '$newName.tinynotes');
    if (normalizePath(oldPath) == normalizePath(newPath)) return newPath;
    if (await storage.exists(newPath)) {
      throw StateError(
        appStrings.fill(appStrings.spaceExists, {'name': newName}),
      );
    }
    await storage.rename(oldPath, newPath);
    return newPath;
  }

  Future<void> deleteSpace(String spacePath) async {
    await storage.remove(spacePath, recursive: true);
  }

  Future<String> renameGroup(String oldPath, String newName) async {
    final parentPath = dirname(oldPath);
    final newPath = joinPath(parentPath, newName);
    if (normalizePath(oldPath) == normalizePath(newPath)) return newPath;
    if (await storage.exists(newPath)) {
      throw StateError(
        appStrings.fill(appStrings.folderExists, {'name': newName}),
      );
    }
    await storage.rename(oldPath, newPath);
    return newPath;
  }

  Future<String> renameNotebook(String oldPath, String newName) async {
    final parentPath = dirname(oldPath);
    final newFileName = newName.endsWith('.md') ? newName : '$newName.md';
    final newPath = joinPath(parentPath, newFileName);
    if (normalizePath(oldPath) == normalizePath(newPath)) return newPath;
    if (await storage.exists(newPath)) {
      throw StateError(
        appStrings.fill(appStrings.notebookExists, {'name': newName}),
      );
    }
    await storage.rename(oldPath, newPath);
    return newPath;
  }

  Future<void> deleteGroup(String groupPath) async {
    await storage.remove(groupPath, recursive: true);
  }

  Future<void> deleteNotebook(String filePath) async {
    await storage.remove(filePath, recursive: false);
  }

  Future<void> ensureSampleLibrary(String storagePath) async {
    final spaces = await loadSpaces(storagePath);
    if (spaces.isNotEmpty) return;

    final s = appStrings;
    final space = await createSpace(storagePath, s.sampleSpaceName);
    final group = await createGroup(space.path, s.sampleGroupName);
    final notebook = await createNotebook(group.path, s.sampleNotebookName);
    final now = DateTime.now().toUtc().toIso8601String();

    await saveNotebook(
      Notebook(
        id: notebook.id,
        name: notebook.name,
        path: notebook.path,
        noteBlocks: [
          NoteBlock(
            id:
                notebook.noteBlocks.isNotEmpty
                    ? notebook.noteBlocks.first.id
                    : 'sample-1',
            title: s.samplePortTitle,
            content: 'lsof -i :8080',
            contentType: ContentType.bash,
            tags: const ['shell'],
            createdAt: now,
            updatedAt: now,
          ),
          NoteBlock(
            id: 'sample-2',
            title: s.sampleGitStatusTitle,
            content: 'git status -sb',
            contentType: ContentType.bash,
            tags: const ['git'],
            createdAt: now,
            updatedAt: now,
          ),
        ],
      ),
    );
  }
}
