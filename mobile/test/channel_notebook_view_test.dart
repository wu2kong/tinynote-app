import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tinynote_mobile/core/types.dart';
import 'package:tinynote_mobile/l10n/l10n.dart';
import 'package:tinynote_mobile/services/library_service.dart';
import 'package:tinynote_mobile/widgets/channel_notebook_view.dart';

class MemoryLibrary extends LibraryService {
  String? saved;
  @override
  Future<void> updateNotebookContent(String content) async {
    saved = content;
  }
}

void main() {
  testWidgets('channel todos support groups, moving tasks and undo', (
    tester,
  ) async {
    final library = MemoryLibrary();
    final notebook = Notebook(
      id: 'todos',
      name: 'Tasks',
      path: '/Tasks.channel.md',
      format: NotebookFormat.channel,
      noteBlocks: const [],
      content: jsonEncode({
        'version': 1,
        'members': [
          {'id': 'self', 'name': 'Me', 'isSelf': true},
        ],
        'messages': [],
        'todos': [
          {
            'id': 'task-1',
            'text': 'First',
            'done': false,
            'createdAt': '2026-01-01T00:00:00Z',
          },
        ],
        'todoGroups': [
          {'id': 'group-1', 'name': 'Work', 'collapsed': false},
        ],
        'links': [],
        'resources': [],
      }),
    );
    final controller = LocaleController(initialLocale: AppLocale.en);
    await tester.pumpWidget(
      LocaleScope(
        controller: controller,
        child: MaterialApp(
          home: Scaffold(
            body: ChannelNotebookView(
              library: library,
              notebook: notebook,
              showDirectoryButton: false,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Todos'));
    await tester.pumpAndSettle();
    expect(find.text('Work (0)'), findsOneWidget);
    await tester.tap(find.byTooltip('Group options').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Work').last);
    await tester.pumpAndSettle();
    expect(jsonDecode(library.saved!)['todos'][0]['groupId'], 'group-1');
    await tester.tap(find.byTooltip('Group options').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete task'));
    await tester.pumpAndSettle();
    expect(jsonDecode(library.saved!)['todos'], isEmpty);
    await tester.tap(find.text('Undo'));
    await tester.pumpAndSettle();
    expect(jsonDecode(library.saved!)['todos'], hasLength(1));
    await tester.tap(find.byTooltip('Group options').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete group and its tasks'));
    await tester.pumpAndSettle();
    expect(jsonDecode(library.saved!)['todoGroups'], isEmpty);
    expect(jsonDecode(library.saved!)['todos'], isEmpty);
    await tester.tap(find.text('Undo'));
    await tester.pumpAndSettle();
    expect(jsonDecode(library.saved!)['todoGroups'], hasLength(1));
    expect(jsonDecode(library.saved!)['todos'], hasLength(1));
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
    library.dispose();
  });

  testWidgets('channel links can be bulk imported and edited', (tester) async {
    final library = MemoryLibrary();
    final notebook = Notebook(
      id: 'links',
      name: 'Links',
      path: '/Links.channel.md',
      format: NotebookFormat.channel,
      noteBlocks: const [],
      content: jsonEncode({
        'version': 1,
        'members': [
          {'id': 'self', 'name': 'Me', 'isSelf': true},
        ],
        'messages': [],
        'todos': [],
        'links': [],
        'resources': [],
      }),
    );
    final controller = LocaleController(initialLocale: AppLocale.en);
    await tester.pumpWidget(
      LocaleScope(
        controller: controller,
        child: MaterialApp(
          home: Scaffold(
            body: ChannelNotebookView(
              library: library,
              notebook: notebook,
              showDirectoryButton: false,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Links').last);
    await tester.tap(find.text('Links').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bulk import links'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextField).last,
      'Example | https://example.com | Note\nhttps://openai.com',
    );
    await tester.tap(find.text('Import'));
    await tester.pumpAndSettle();
    final saved = jsonDecode(library.saved!);
    expect(saved['links'], hasLength(2));
    expect(saved['links'][0]['note'], 'Note');
    expect(saved['links'][1]['title'], 'openai.com');
    await tester.tap(find.byTooltip('Link actions').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Edit link'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Title (optional)'),
      'Edited',
    );
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(jsonDecode(library.saved!)['links'][0]['title'], 'Edited');
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
    library.dispose();
  });

  testWidgets(
    'channel searches, sends as selected member and persists display settings',
    (tester) async {
      final library = MemoryLibrary();
      final notebook = Notebook(
        id: 'team',
        name: 'Team',
        path: '/Team.channel.md',
        format: NotebookFormat.channel,
        noteBlocks: const [],
        content: jsonEncode({
          'version': 1,
          'members': [
            {'id': 'self', 'name': 'Me', 'isSelf': true},
            {'id': 'alice', 'name': 'Alice'},
          ],
          'messages': [
            {
              'id': 'one',
              'authorId': 'alice',
              'content': 'First message',
              'sentAt': '2026-10-30T01:00:00Z',
            },
          ],
          'todos': [],
          'links': [],
          'resources': [],
          'futureField': 'preserve me',
        }),
      );
      final controller = LocaleController(initialLocale: AppLocale.en);
      await tester.pumpWidget(
        LocaleScope(
          controller: controller,
          child: MaterialApp(
            home: Scaffold(
              body: ChannelNotebookView(
                library: library,
                notebook: notebook,
                showDirectoryButton: false,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextField>(find.byType(TextField).last)
            .focusNode!
            .hasFocus,
        isTrue,
      );
      await tester.enterText(find.byType(TextField).first, 'not found');
      await tester.pump();
      expect(find.text('No matching messages.'), findsOneWidget);
      await tester.enterText(find.byType(TextField).first, '');
      await tester.tap(find.widgetWithText(TextButton, 'Alice'));
      await tester.enterText(find.byType(TextField).last, 'New message');
      await tester.tap(find.byTooltip('Send'));
      await tester.pumpAndSettle();
      var saved = jsonDecode(library.saved!);
      expect(saved['messages'].last['authorId'], 'alice');
      expect(saved['futureField'], 'preserve me');
      await tester.ensureVisible(find.text('Settings'));
      await tester.tap(find.text('Settings'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Show message time'));
      await tester.pumpAndSettle();
      saved = jsonDecode(library.saved!);
      expect(saved['showTime'], isFalse);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      controller.dispose();
      library.dispose();
    },
  );
}
