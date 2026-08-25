import 'dart:convert';

import 'package:flutter/services.dart';

import '../l10n/app_locale.dart';
import '../storage/local_storage.dart';
import 'path_utils.dart';

const sampleLibraryAsset = 'assets/sample_library.json';

class OfficialSampleFile {
  const OfficialSampleFile({required this.relativePath, required this.content});

  final String relativePath;
  final String content;
}

class OfficialSampleLibraryDefinition {
  const OfficialSampleLibraryDefinition({
    required this.spaceName,
    required this.files,
  });

  final String spaceName;
  final List<OfficialSampleFile> files;
}

class OfficialSampleLibraryImportResult {
  const OfficialSampleLibraryImportResult({
    required this.spaceName,
    required this.spacePath,
    required this.welcomeNotebookPath,
    required this.noteCount,
  });

  final String spaceName;
  final String spacePath;
  final String welcomeNotebookPath;
  final int noteCount;
}

OfficialSampleLibraryDefinition parseOfficialSampleLibraryDefinition(
  Map<String, dynamic> decoded,
  AppLocale locale,
) {
  final entry = decoded[locale.localeId] as Map<String, dynamic>? ??
      decoded['en'] as Map<String, dynamic>;
  final files = (entry['files'] as List<dynamic>)
      .map(
        (item) => OfficialSampleFile(
          relativePath: (item as Map<String, dynamic>)['relativePath'] as String,
          content: item['content'] as String,
        ),
      )
      .toList();
  return OfficialSampleLibraryDefinition(
    spaceName: entry['spaceName'] as String,
    files: files,
  );
}

Future<OfficialSampleLibraryDefinition> loadOfficialSampleLibraryDefinition(
  AppLocale locale,
) async {
  final raw = await rootBundle.loadString(sampleLibraryAsset);
  return parseOfficialSampleLibraryDefinition(
    jsonDecode(raw) as Map<String, dynamic>,
    locale,
  );
}

Future<({String name, String path})> _findAvailableSpace(
  LocalStorage storage,
  String storagePath,
  String baseName,
) async {
  for (var index = 1; index < 10000; index += 1) {
    final name = index == 1 ? baseName : '$baseName $index';
    final path = joinPath(storagePath, '$name.tinynotes');
    if (!await storage.exists(path)) return (name: name, path: path);
  }
  throw StateError('Unable to find an available name for the sample library');
}

Future<OfficialSampleLibraryImportResult> importOfficialSampleLibraryToStorage({
  required LocalStorage storage,
  required String storagePath,
  required AppLocale locale,
}) async {
  final root = normalizePath(storagePath);
  final sample = await loadOfficialSampleLibraryDefinition(locale);
  final target = await _findAvailableSpace(storage, root, sample.spaceName);

  await storage.mkdir(target.path, recursive: true);
  try {
    for (final file in sample.files) {
      await storage.writeTextFile(
        joinPath(target.path, file.relativePath),
        file.content,
      );
    }
  } catch (error) {
    try {
      await storage.remove(target.path, recursive: true);
    } catch (_) {}
    rethrow;
  }

  return OfficialSampleLibraryImportResult(
    spaceName: target.name,
    spacePath: target.path,
    welcomeNotebookPath: joinPath(target.path, sample.files.first.relativePath),
    noteCount: sample.files.length,
  );
}
