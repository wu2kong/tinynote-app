import 'package:flutter_test/flutter_test.dart';
import 'package:tinynote_mobile/core/notebook_format.dart';

void main() {
  group('detectNotebookFormat', () {
    test('matches longest suffix first', () {
      expect(detectNotebookFormat('a.writer.md'), NotebookFormat.writer);
      expect(detectNotebookFormat('a.mk.md'), NotebookFormat.markdown);
      expect(detectNotebookFormat('a.blk.md'), NotebookFormat.blocks);
      expect(detectNotebookFormat('a.md'), NotebookFormat.blocks);
      expect(detectNotebookFormat('A.WRITER.MD'), NotebookFormat.writer);
    });
  });

  group('notebookDisplayName', () {
    test('strips canonical and legacy suffixes', () {
      expect(notebookDisplayName('Shell.blk.md'), 'Shell');
      expect(notebookDisplayName('Guide.mk.md'), 'Guide');
      expect(notebookDisplayName('Essay.writer.md'), 'Essay');
      expect(notebookDisplayName('Legacy.md'), 'Legacy');
    });
  });

  group('resolveNotebookFileName', () {
    test('new block notebooks use .blk.md', () {
      final resolved = resolveNotebookFileName('Commands');
      expect(resolved.fileName, 'Commands.blk.md');
      expect(resolved.format, NotebookFormat.blocks);
      expect(resolved.displayName, 'Commands');
    });

    test('new markdown and writer notebooks use compound suffixes', () {
      expect(
        resolveNotebookFileName('Guide', preferredFormat: NotebookFormat.markdown).fileName,
        'Guide.mk.md',
      );
      expect(
        resolveNotebookFileName('Essay', preferredFormat: NotebookFormat.writer).fileName,
        'Essay.writer.md',
      );
    });

    test('rename keeps legacy .md suffix', () {
      final resolved = resolveNotebookFileName(
        'Renamed',
        preferredFormat: NotebookFormat.blocks,
        preserveExtension: '.md',
      );
      expect(resolved.fileName, 'Renamed.md');
      expect(resolved.format, NotebookFormat.blocks);
    });

    test('rename keeps writer suffix', () {
      final resolved = resolveNotebookFileName(
        'New title',
        preferredFormat: NotebookFormat.writer,
        preserveExtension: '.writer.md',
      );
      expect(resolved.fileName, 'New title.writer.md');
      expect(resolved.format, NotebookFormat.writer);
    });

    test('accepts a full filename', () {
      final resolved = resolveNotebookFileName('notes.writer.md');
      expect(resolved.fileName, 'notes.writer.md');
      expect(resolved.format, NotebookFormat.writer);
      expect(resolved.displayName, 'notes');
    });
  });

  group('replaceNotebookFormatSuffix', () {
    test('swaps markdown and writer without touching the body name', () {
      expect(
        replaceNotebookFormatSuffix('Essay.writer.md', NotebookFormat.markdown),
        'Essay.mk.md',
      );
      expect(
        replaceNotebookFormatSuffix('Guide.mk.md', NotebookFormat.writer),
        'Guide.writer.md',
      );
    });
  });

  test('only markdown and writer are swappable', () {
    expect(NotebookFormat.markdown.swappableArticleFormat, NotebookFormat.writer);
    expect(NotebookFormat.writer.swappableArticleFormat, NotebookFormat.markdown);
    expect(NotebookFormat.blocks.swappableArticleFormat, isNull);
    expect(NotebookFormat.markdown.isDocument, isTrue);
    expect(NotebookFormat.blocks.isDocument, isFalse);
  });

  test('plain .md becomes writer, marked files stay', () {
    expect(
      resolveImportedNotebookFileName('plain.md').fileName,
      'plain.writer.md',
    );
    expect(resolveImportedNotebookFileName('plain.md').converted, isTrue);
    expect(
      resolveImportedNotebookFileName('guide.mk.md').fileName,
      'guide.mk.md',
    );
    expect(resolveImportedNotebookFileName('guide.mk.md').converted, isFalse);
    expect(
      resolveImportedNotebookFileName('cards.blk.md').fileName,
      'cards.blk.md',
    );
    expect(
      resolveImportedNotebookFileName('essay.writer.md').fileName,
      'essay.writer.md',
    );
  });
}
