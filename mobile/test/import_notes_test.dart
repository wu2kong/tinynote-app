import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:tinynote_mobile/core/import_notes.dart';
import 'package:tinynote_mobile/core/official_sample_library.dart';
import 'package:tinynote_mobile/l10n/app_locale.dart';
import 'package:tinynote_mobile/storage/local_storage.dart';

void main() {
  group('convertImportRelativePath', () {
    test('rewrites unmarked markdown and keeps marked files', () {
      expect(convertImportRelativePath('plain.md').relativePath, 'plain.writer.md');
      expect(convertImportRelativePath('plain.md').converted, isTrue);
      expect(
        convertImportRelativePath('Folder/note.blk.md').relativePath,
        'Folder/note.blk.md',
      );
      expect(convertImportRelativePath('Folder/note.blk.md').converted, isFalse);
    });
  });

  group('importNotesToSpaceRoot', () {
    late Directory tempDir;
    late LocalStorage storage;
    late String spacePath;

    setUp(() async {
      tempDir = await Directory.systemTemp.createTemp('tinynote-import-');
      storage = LocalStorage(tempDir.path);
      spacePath = '${tempDir.path}/Demo.tinynotes';
      await Directory(spacePath).create(recursive: true);
    });

    tearDown(() async {
      if (await tempDir.exists()) {
        await tempDir.delete(recursive: true);
      }
    });

    test('imports unmarked md as writer notes and keeps markers', () async {
      final result = await importNotesToSpaceRoot(
        storage: storage,
        spacePath: spacePath,
        sources: [
          ImportNoteSource(
            relativePath: 'plain.md',
            readText: () async => '# Hello\n',
          ),
          ImportNoteSource(
            relativePath: 'cards.blk.md',
            readText: () async => '---\ntitle: Cards\n---\n',
          ),
        ],
      );

      expect(result.imported, 2);
      expect(result.converted, 1);
      expect(result.skipped, 0);
      expect(await File('$spacePath/plain.writer.md').exists(), isTrue);
      expect(await File('$spacePath/cards.blk.md').exists(), isTrue);
    });

    test('keeps directory structure and unique names', () async {
      await File('$spacePath/plain.writer.md').writeAsString('# existing\n');
      final result = await importNotesToSpaceRoot(
        storage: storage,
        spacePath: spacePath,
        sources: [
          ImportNoteSource(
            relativePath: 'plain.md',
            readText: () async => '# next\n',
          ),
          ImportNoteSource(
            relativePath: 'Folder/nested.md',
            groupId: '/tmp/source-a',
            readText: () async => '# nested\n',
          ),
        ],
      );

      expect(result.imported, 2);
      expect(await File('$spacePath/plain (2).writer.md').exists(), isTrue);
      expect(await File('$spacePath/Folder/nested.writer.md').exists(), isTrue);
    });
  });

  group('official sample library JSON', () {
    test('has a definition for every app locale', () {
      final decoded =
          jsonDecode(File('assets/sample_library.json').readAsStringSync())
              as Map<String, dynamic>;
      for (final locale in AppLocale.values) {
        final sample = parseOfficialSampleLibraryDefinition(decoded, locale);
        expect(sample.spaceName, isNotEmpty);
        expect(sample.files, isNotEmpty);
        expect(sample.files.first.relativePath, contains('/'));
        expect(sample.files.first.content, isNotEmpty);
      }
    });
  });
}
