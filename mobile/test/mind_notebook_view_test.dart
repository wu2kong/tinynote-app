import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tinynote_mobile/core/types.dart';
import 'package:tinynote_mobile/l10n/l10n.dart';
import 'package:tinynote_mobile/services/library_service.dart';
import 'package:tinynote_mobile/widgets/mind_notebook_view.dart';

class MemoryLibrary extends LibraryService {
  String? saved;
  @override
  Future<void> updateNotebookContent(String content) async {
    saved = content;
  }
}

void main() {
  testWidgets('copies full Markdown with headings and nested bullets', (
    tester,
  ) async {
    String? copied;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
          if (call.method == 'Clipboard.setData') {
            copied = (call.arguments as Map)['text'] as String;
          }
          return null;
        });
    final library = MemoryLibrary();
    final controller = LocaleController(initialLocale: AppLocale.en);
    final note = Notebook(
      id: 'mind',
      name: 'Ideas',
      path: '/Ideas.mind.md',
      format: NotebookFormat.mind,
      noteBlocks: const [],
      content: jsonEncode({
        'version': 1,
        'mode': 'outline',
        'nodes': [
          {
            'id': 'a',
            'text': 'First',
            'collapsed': true,
            'children': [
              {
                'id': 'b',
                'text': 'Child',
                'children': [
                  {'id': 'c', 'text': 'Grandchild', 'children': []},
                ],
              },
            ],
          },
          {'id': 'd', 'text': 'Second', 'children': []},
        ],
      }),
    );
    await tester.pumpWidget(
      LocaleScope(
        controller: controller,
        child: MaterialApp(
          home: Scaffold(
            body: MindNotebookView(
              library: library,
              notebook: note,
              showDirectoryButton: false,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Copy full content'));
    await tester.pumpAndSettle();
    expect(
      copied,
      '# Ideas\n\n## First\n- Child\n  - Grandchild\n\n## Second\n',
    );
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
    library.dispose();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });

  testWidgets('expand all and collapse all persist every descendant', (
    tester,
  ) async {
    final library = MemoryLibrary();
    final controller = LocaleController(initialLocale: AppLocale.en);
    final note = Notebook(
      id: 'mind',
      name: 'Ideas',
      path: '/Ideas.mind.md',
      format: NotebookFormat.mind,
      noteBlocks: const [],
      content: jsonEncode({
        'version': 1,
        'mode': 'outline',
        'nodes': [
          {
            'id': 'root',
            'text': 'Root',
            'collapsed': true,
            'children': [
              {
                'id': 'child',
                'text': 'Child',
                'collapsed': true,
                'children': [
                  {'id': 'leaf', 'text': 'Leaf', 'children': []},
                ],
              },
            ],
          },
        ],
      }),
    );
    await tester.pumpWidget(
      LocaleScope(
        controller: controller,
        child: MaterialApp(
          home: Scaffold(
            body: MindNotebookView(
              library: library,
              notebook: note,
              showDirectoryButton: false,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Child'), findsNothing);
    await tester.tap(find.byKey(const ValueKey('mind-toggle-all:root')));
    await tester.pumpAndSettle();
    expect(find.text('Leaf'), findsOneWidget);
    var saved = jsonDecode(library.saved!)['nodes'][0];
    expect(saved['collapsed'], false);
    expect(saved['children'][0]['collapsed'], false);
    await tester.tap(find.byKey(const ValueKey('mind-toggle-all:root')));
    await tester.pumpAndSettle();
    expect(find.text('Child'), findsNothing);
    saved = jsonDecode(library.saved!)['nodes'][0];
    expect(saved['collapsed'], true);
    expect(saved['children'][0]['collapsed'], true);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
    library.dispose();
  });

  testWidgets('moves a topic with its descendants across levels and to root', (
    tester,
  ) async {
    final library = MemoryLibrary();
    final controller = LocaleController(initialLocale: AppLocale.en);
    final note = Notebook(
      id: 'mind',
      name: 'Ideas',
      path: '/Ideas.mind.md',
      format: NotebookFormat.mind,
      noteBlocks: const [],
      content: jsonEncode({
        'version': 1,
        'mode': 'outline',
        'nodes': [
          {
            'id': 'a',
            'text': 'A',
            'children': [
              {
                'id': 'c',
                'text': 'C',
                'children': [
                  {'id': 'd', 'text': 'D', 'children': []},
                ],
              },
            ],
          },
          {'id': 'b', 'text': 'B', 'children': []},
        ],
      }),
    );
    await tester.pumpWidget(
      LocaleScope(
        controller: controller,
        child: MaterialApp(
          home: Scaffold(
            body: MindNotebookView(
              library: library,
              notebook: note,
              showDirectoryButton: false,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('mind-actions:c')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Move to…'));
    await tester.pumpAndSettle();
    expect(find.text('D'), findsOneWidget); // Descendant is not a destination.
    await tester.tap(find.text('B').last);
    await tester.pumpAndSettle();
    final moved = jsonDecode(library.saved!)['nodes'] as List;
    expect(moved[0]['children'], isEmpty);
    expect(moved[1]['children'][0]['id'], 'c');
    expect(moved[1]['children'][0]['children'][0]['id'], 'd');
    await tester.tap(find.byKey(const ValueKey('mind-actions:c')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Move to…'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Root level'));
    await tester.pumpAndSettle();
    final rooted = jsonDecode(library.saved!)['nodes'] as List;
    expect(rooted.map((node) => node['id']).toList(), ['a', 'b', 'c']);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
    library.dispose();
  });

  testWidgets('mind note creates nested topics and restores map mode', (
    tester,
  ) async {
    final library = MemoryLibrary();
    final controller = LocaleController(initialLocale: AppLocale.en);
    Notebook note(String content) => Notebook(
      id: 'mind',
      name: 'Ideas',
      path: '/Ideas.mind.md',
      format: NotebookFormat.mind,
      noteBlocks: const [],
      content: content,
    );
    Widget screen(String content, Key key) => LocaleScope(
      controller: controller,
      child: MaterialApp(
        home: Scaffold(
          body: MindNotebookView(
            key: key,
            library: library,
            notebook: note(content),
            showDirectoryButton: false,
          ),
        ),
      ),
    );
    await tester.pumpWidget(
      screen(
        jsonEncode({'version': 1, 'mode': 'outline', 'nodes': []}),
        const ValueKey('first'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Add root topic'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'Root');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(jsonDecode(library.saved!)['nodes'][0]['text'], 'Root');
    await tester.tap(find.byTooltip('Add topic').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Add child topic'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'Child');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(
      jsonDecode(library.saved!)['nodes'][0]['children'][0]['text'],
      'Child',
    );
    await tester.tap(find.text('Mind Map'));
    await tester.pumpAndSettle();
    expect(jsonDecode(library.saved!)['mode'], 'mindmap');
    await tester.pumpWidget(screen(library.saved!, const ValueKey('reopened')));
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Mind Map'))
          .selected,
      isTrue,
    );
    expect(find.text('Child'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
    library.dispose();
  });
}
