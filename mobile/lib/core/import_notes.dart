import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import '../storage/local_storage.dart';
import 'notebook_format.dart';
import 'path_utils.dart';
import 'workspace_config.dart';

class ImportNoteSource {
  const ImportNoteSource({
    required this.relativePath,
    required this.readText,
    this.groupId,
    this.sourcePath,
  });

  final String relativePath;
  final String? groupId;
  final String? sourcePath;
  final Future<String> Function() readText;
}

class ImportNotesResult {
  const ImportNotesResult({
    required this.imported,
    required this.converted,
    required this.skipped,
  });

  final int imported;
  final int converted;
  final int skipped;
}

bool _isHiddenPath(String relativePath) {
  return relativePath.split('/').any((segment) => segment.startsWith('.'));
}

({String relativePath, bool converted}) convertImportRelativePath(String relativePath) {
  final parts = relativePath.split('/').where((part) => part.isNotEmpty).toList();
  if (parts.isEmpty) {
    return (relativePath: relativePath, converted: false);
  }
  final resolved = resolveImportedNotebookFileName(parts.last);
  parts[parts.length - 1] = resolved.fileName;
  return (relativePath: parts.join('/'), converted: resolved.converted);
}

Future<String> _allocateUniqueDirName(
  LocalStorage storage,
  String parentPath,
  String name,
  Set<String> taken,
) async {
  var candidate = name;
  var n = 2;
  while (taken.contains(candidate) ||
      await storage.exists(joinPath(parentPath, candidate))) {
    candidate = '$name ($n)';
    n += 1;
  }
  taken.add(candidate);
  return candidate;
}

Future<String> _allocateUniqueFilePath(
  LocalStorage storage,
  String destPath,
) async {
  if (!await storage.exists(destPath)) return destPath;
  final parentPath = dirname(destPath);
  final fileName = basename(destPath);
  final format = detectNotebookFormat(fileName);
  final displayName = notebookDisplayName(fileName);
  final preserveExtension =
      format.isUnsupported ? matchedNotebookSuffix(fileName) : null;
  var n = 2;
  while (true) {
    final nextName = resolveNotebookFileName(
      '$displayName ($n)',
      preferredFormat: format,
      preserveExtension: preserveExtension,
    ).fileName;
    final nextPath = joinPath(parentPath, nextName);
    if (!await storage.exists(nextPath)) return nextPath;
    n += 1;
  }
}

Future<List<ImportNoteSource>> collectSourcesFromFilePaths(List<String> filePaths) async {
  final sources = <ImportNoteSource>[];
  for (final path in filePaths) {
    final name = basename(path);
    if (!isMarkdownNotebookFileName(name) || name.startsWith('.')) continue;
    final captured = path;
    sources.add(
      ImportNoteSource(
        relativePath: name,
        sourcePath: captured,
        readText: () => File(captured).readAsString(),
      ),
    );
  }
  return sources;
}

Future<List<ImportNoteSource>> collectSourcesFromBytes({
  required String fileName,
  required List<int> bytes,
}) async {
  if (!isMarkdownNotebookFileName(fileName) || fileName.startsWith('.')) {
    return const [];
  }
  final content = utf8.decode(Uint8List.fromList(bytes), allowMalformed: true);
  return [
    ImportNoteSource(
      relativePath: basename(fileName),
      readText: () async => content,
    ),
  ];
}

Future<List<ImportNoteSource>> collectSourcesFromDirectory(String dirPath) async {
  final normalized = normalizePath(dirPath);
  final dirName = basename(normalized);
  if (dirName.isEmpty ||
      dirName.startsWith('.') ||
      isNoteSpaceDirectoryName(dirName)) {
    return const [];
  }
  final files = await _walkMarkdownFiles(normalized, dirName);
  return [
    for (final file in files)
      ImportNoteSource(
        relativePath: file.relativePath,
        groupId: normalized,
        sourcePath: file.sourcePath,
        readText: () => File(file.sourcePath).readAsString(),
      ),
  ];
}

Future<List<({String sourcePath, String relativePath})>> _walkMarkdownFiles(
  String dirPath,
  String relativePrefix,
) async {
  final dir = Directory(dirPath);
  if (!await dir.exists()) return const [];
  final results = <({String sourcePath, String relativePath})>[];
  try {
    await for (final entry in dir.list(followLinks: false)) {
      final name = basename(entry.path);
      if (name.isEmpty ||
          name.startsWith('.') ||
          isNoteSpaceDirectoryName(name)) {
        continue;
      }
      final childRelative =
          relativePrefix.isEmpty ? name : '$relativePrefix/$name';
      if (entry is Directory) {
        results.addAll(await _walkMarkdownFiles(entry.path, childRelative));
      } else if (entry is File && isMarkdownNotebookFileName(name)) {
        results.add((sourcePath: entry.path, relativePath: childRelative));
      }
    }
  } catch (_) {
    return results;
  }
  return results;
}

Future<ImportNotesResult> importNotesToSpaceRoot({
  required LocalStorage storage,
  required String spacePath,
  required List<ImportNoteSource> sources,
}) async {
  final destRoot = normalizePath(spacePath);
  var imported = 0;
  var convertedCount = 0;
  var skipped = 0;
  final groupRootMap = <String, String>{};
  final takenRoots = <String>{};

  for (final source in sources) {
    if (!isMarkdownNotebookFileName(basename(source.relativePath)) ||
        _isHiddenPath(source.relativePath)) {
      skipped += 1;
      continue;
    }

    final converted = convertImportRelativePath(source.relativePath);
    var destRelative = converted.relativePath;
    final parts = destRelative.split('/').where((part) => part.isNotEmpty).toList();
    if (parts.isEmpty || parts.contains('..')) {
      skipped += 1;
      continue;
    }

    if (source.groupId != null && parts.length > 1) {
      var uniqueRoot = groupRootMap[source.groupId];
      if (uniqueRoot == null) {
        uniqueRoot = await _allocateUniqueDirName(
          storage,
          destRoot,
          parts.first,
          takenRoots,
        );
        groupRootMap[source.groupId!] = uniqueRoot;
      }
      parts[0] = uniqueRoot;
      destRelative = parts.join('/');
    }

    final destPath = await _allocateUniqueFilePath(
      storage,
      joinPath(destRoot, destRelative),
    );
    final sourcePath = source.sourcePath;
    if (sourcePath != null &&
        normalizePath(sourcePath) == normalizePath(destPath)) {
      skipped += 1;
      continue;
    }
    if (sourcePath != null &&
        isSubPath(sourcePath, destPath) &&
        destPath != normalizePath(sourcePath)) {
      skipped += 1;
      continue;
    }

    try {
      final parentDir = dirname(destPath);
      if (parentDir.isNotEmpty && parentDir != destRoot) {
        await storage.mkdir(parentDir, recursive: true);
      }
      final content = await source.readText();
      await storage.writeTextFile(destPath, content);
      imported += 1;
      if (converted.converted) convertedCount += 1;
    } catch (_) {
      skipped += 1;
    }
  }

  return ImportNotesResult(
    imported: imported,
    converted: convertedCount,
    skipped: skipped,
  );
}
