import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../core/workspace_config.dart';

const libraryDirName = 'tinynote-library';

String sanitizePath(String path) {
  var normalized = path.trim();
  if (normalized.startsWith('file://')) {
    normalized = normalized.substring(7);
  }
  return p.normalize(normalized);
}

bool isValidLibraryRoot(
  String rootPath, {
  String? documentsPath,
  bool allowExternal = false,
}) {
  final root = sanitizePath(rootPath);
  if (root.isEmpty) return false;

  if (documentsPath != null) {
    final docs = sanitizePath(documentsPath);
    if (root != docs &&
        root.startsWith('$docs${Platform.pathSeparator}') &&
        p.basename(root) == libraryDirName) {
      return true;
    }
  }

  // External / iCloud Drive folders chosen via Files picker.
  if (allowExternal && root.length > 1) {
    return true;
  }

  return false;
}

/// Prefer the picked folder if it already looks like a TinyNote library;
/// otherwise use / create `tinynote-library` inside it.
Future<String> resolveExternalLibraryRoot(String pickedPath) async {
  final picked = sanitizePath(pickedPath);
  final dir = Directory(picked);
  if (!await dir.exists()) {
    await dir.create(recursive: true);
  }

  if (p.basename(picked) == libraryDirName) {
    return picked;
  }

  try {
    await for (final entity in dir.list(followLinks: false)) {
      if (entity is Directory) {
        final name = p.basename(entity.path);
        if (isNoteSpaceDirectoryName(name) || name == libraryDirName) {
          if (name == libraryDirName) {
            return sanitizePath(entity.path);
          }
          // Folder already contains spaces → treat as library root.
          return picked;
        }
      }
    }
  } catch (_) {
    // Fall through to nested library dir.
  }

  final nested = sanitizePath(p.join(picked, libraryDirName));
  await Directory(nested).create(recursive: true);
  return nested;
}

class LocalStorage {
  LocalStorage(this.rootPath);

  final String rootPath;

  static Future<String> defaultRootPath() async {
    final docs = await getApplicationDocumentsDirectory();
    return sanitizePath(p.join(docs.path, libraryDirName));
  }

  static Future<String> resolveRootPath(
    String? savedPath, {
    bool externalEnabled = false,
    String? externalLibraryPath,
  }) async {
    final docs = await getApplicationDocumentsDirectory();
    final defaultPath = sanitizePath(p.join(docs.path, libraryDirName));

    if (externalEnabled &&
        externalLibraryPath != null &&
        externalLibraryPath.isNotEmpty) {
      final external = sanitizePath(externalLibraryPath);
      if (isValidLibraryRoot(
        external,
        documentsPath: docs.path,
        allowExternal: true,
      )) {
        return external;
      }
    }

    if (savedPath == null || savedPath.isEmpty) {
      return defaultPath;
    }

    final candidate = sanitizePath(savedPath);
    if (isValidLibraryRoot(
      candidate,
      documentsPath: docs.path,
      allowExternal: externalEnabled,
    )) {
      return candidate;
    }
    return defaultPath;
  }

  Future<void> ensureRoot() async {
    final dir = Directory(rootPath);
    if (await dir.exists()) return;
    await dir.create(recursive: true);
  }

  Future<bool> isEmptyLibrary() async {
    final dir = Directory(rootPath);
    if (!await dir.exists()) return true;
    try {
      return await dir.list(followLinks: false).isEmpty;
    } catch (_) {
      return true;
    }
  }

  Future<void> copyLibraryFrom(String sourceRoot) async {
    final source = Directory(sanitizePath(sourceRoot));
    final destination = Directory(rootPath);
    if (!await source.exists()) return;
    if (sanitizePath(source.path) == sanitizePath(destination.path)) return;

    if (await destination.exists()) {
      await destination.delete(recursive: true);
    }
    await _copyDirectory(source, destination);
  }

  Future<List<FileSystemEntity>> readDir(String path) async {
    final dir = Directory(path);
    if (!await dir.exists()) return [];
    try {
      return dir.list(followLinks: false).toList();
    } catch (_) {
      return [];
    }
  }

  Future<String> readTextFile(String path) => File(path).readAsString();

  Future<void> writeTextFile(String path, String content) async {
    final file = File(path);
    await file.parent.create(recursive: true);
    await file.writeAsString(content);
  }

  Future<void> mkdir(String path, {bool recursive = false}) async {
    await Directory(path).create(recursive: recursive);
  }

  Future<void> remove(String path, {bool recursive = false}) async {
    final entity = FileSystemEntity.typeSync(path);
    if (entity == FileSystemEntityType.directory) {
      final dir = Directory(path);
      if (recursive) {
        await dir.delete(recursive: true);
      } else {
        await dir.delete();
      }
      return;
    }
    if (entity == FileSystemEntityType.file) {
      await File(path).delete();
    }
  }

  Future<void> rename(String oldPath, String newPath) async {
    final type = FileSystemEntity.typeSync(oldPath);
    if (type == FileSystemEntityType.directory) {
      await Directory(oldPath).rename(newPath);
      return;
    }
    await File(oldPath).rename(newPath);
  }

  Future<bool> exists(String path) async {
    return FileSystemEntity.typeSync(path) != FileSystemEntityType.notFound;
  }

  static Future<void> _copyDirectory(Directory source, Directory destination) async {
    await destination.create(recursive: true);
    await for (final entity in source.list(recursive: false, followLinks: false)) {
      final name = p.basename(entity.path);
      if (name.startsWith('.') && name != '.tinynotes') continue;
      if (name.endsWith('.icloud')) continue;

      final targetPath = p.join(destination.path, name);
      if (entity is Directory) {
        await _copyDirectory(entity, Directory(targetPath));
      } else if (entity is File) {
        await entity.copy(targetPath);
      }
    }
  }
}
