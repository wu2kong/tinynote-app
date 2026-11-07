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
  testWidgets('editing bookmarks preserves desktop categories and tags', (tester) async {
    final library = MemoryLibrary();
    final controller = LocaleController(initialLocale: AppLocale.en);
    final metadata = {
      'linkCategories': [{'id': 'work', 'name': 'Work'}],
      'linkTags': [{'id': 'daily', 'name': 'Daily'}],
      'linkNavigationCollapsed': true,
      'linkView': 'table',
      'linkNavigationMode': 'tag',
    };
    final notebook = Notebook(
      id: 'organized', name: 'Organized', path: '/Organized.link.md',
      format: NotebookFormat.link, noteBlocks: const [],
      content: jsonEncode({'version': 1, ...metadata, 'links': [
        {'id': 'one', 'url': 'https://example.com', 'title': 'Example', 'note': '', 'createdAt': '2026-11-04T00:00:00Z', 'categoryId': 'work', 'tagIds': ['daily']},
      ]}),
    );
    await tester.pumpWidget(LocaleScope(controller: controller, child: MaterialApp(
      home: Scaffold(body: ChannelNotebookView(library: library, notebook: notebook, linksOnly: true, showDirectoryButton: false)),
    )));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Link actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Edit link'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Title (optional)'), 'Updated');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    final saved = jsonDecode(library.saved!) as Map<String, dynamic>;
    for (final entry in metadata.entries) {
      expect(saved[entry.key], entry.value);
    }
    expect(saved['links'][0]['title'], 'Updated');
    expect(saved['links'][0]['categoryId'], 'work');
    expect(saved['links'][0]['tagIds'], ['daily']);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
    library.dispose();
  });

  testWidgets('standalone bookmark note keeps only links when saving', (tester) async {
    final library = MemoryLibrary();
    final controller = LocaleController(initialLocale: AppLocale.en);
    final notebook = Notebook(
      id: 'bookmarks', name: 'Bookmarks', path: '/Bookmarks.link.md',
      format: NotebookFormat.link, noteBlocks: const [],
      content: jsonEncode({'version': 1, 'links': [
        {'id': 'one', 'url': 'https://example.com', 'title': 'Example', 'note': '', 'createdAt': '2026-11-03T00:00:00Z'},
      ]}),
    );
    await tester.pumpWidget(LocaleScope(controller: controller, child: MaterialApp(
      home: Scaffold(body: ChannelNotebookView(library: library, notebook: notebook, linksOnly: true, showDirectoryButton: false)),
    )));
    await tester.pumpAndSettle();
    expect(find.text('Example'), findsOneWidget);
    expect(find.text('Chat'), findsNothing);
    await tester.tap(find.byTooltip('Link actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete link'));
    await tester.pumpAndSettle();
    expect(jsonDecode(library.saved!).keys.toList(), ['version', 'links']);
    expect(jsonDecode(library.saved!)['links'], isEmpty);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
    library.dispose();
  });

  testWidgets('todo view mode is saved and restored on reopen', (tester) async {
    final library = MemoryLibrary();
    Notebook note(String content) => Notebook(
      id: 'view',
      name: 'Tasks',
      path: '/Tasks.todo.md',
      format: NotebookFormat.todo,
      noteBlocks: const [],
      content: content,
    );
    final controller = LocaleController(initialLocale: AppLocale.en);
    Widget screen(String content, Key key) => LocaleScope(
      controller: controller,
      child: MaterialApp(
        home: Scaffold(
          body: ChannelNotebookView(
            key: key,
            library: library,
            notebook: note(content),
            todoOnly: true,
            showDirectoryButton: false,
          ),
        ),
      ),
    );
    await tester.pumpWidget(
      screen(
        jsonEncode({'version': 1, 'todos': [], 'todoGroups': []}),
        const ValueKey('first'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('board:')), findsNothing);
    await tester.tap(find.widgetWithText(TextButton, 'Board'));
    await tester.pumpAndSettle();
    expect(jsonDecode(library.saved!)['todoView'], 'board');
    await tester.pumpWidget(screen(library.saved!, const ValueKey('reopened')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('board:')), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
    library.dispose();
  });

  testWidgets('board view reorders tasks within a group', (tester) async {
    final library = MemoryLibrary();
    final notebook = Notebook(
      id: 'order',
      name: 'Order',
      path: '/Order.todo.md',
      format: NotebookFormat.todo,
      noteBlocks: const [],
      content: jsonEncode({
        'version': 1,
        'todos': [
          {
            'id': 'one',
            'text': 'First',
            'done': false,
            'createdAt': '2026-11-03T00:00:00Z',
            'groupId': 'work',
          },
          {
            'id': 'two',
            'text': 'Second',
            'done': false,
            'createdAt': '2026-11-03T00:00:00Z',
            'groupId': 'work',
          },
        ],
        'todoGroups': [
          {'id': 'work', 'name': 'Work', 'collapsed': false},
        ],
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
              todoOnly: true,
              showDirectoryButton: false,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Board'));
    await tester.pumpAndSettle();
    final gesture = await tester.startGesture(
      tester.getCenter(find.text('Second')),
    );
    await tester.pump(const Duration(milliseconds: 700));
    await gesture.moveTo(tester.getCenter(find.text('First')));
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();
    expect(
      (jsonDecode(library.saved!)['todos'] as List)
          .map((task) => task['id'])
          .toList(),
      ['two', 'one'],
    );
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
    library.dispose();
  });

  testWidgets('board view moves a task to another group by long press drag', (
    tester,
  ) async {
    final library = MemoryLibrary();
    final notebook = Notebook(
      id: 'board',
      name: 'Board',
      path: '/Board.todo.md',
      format: NotebookFormat.todo,
      noteBlocks: const [],
      content: jsonEncode({
        'version': 1,
        'todos': [
          {
            'id': 'task-1',
            'text': 'First',
            'done': false,
            'createdAt': '2026-11-03T00:00:00Z',
          },
        ],
        'todoGroups': [
          {'id': 'work', 'name': 'Work', 'collapsed': false},
          {'id': 'home', 'name': 'Home', 'collapsed': false},
        ],
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
              todoOnly: true,
              showDirectoryButton: false,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Board'));
    await tester.pumpAndSettle();
    expect(find.text('Work (0)'), findsOneWidget);
    final gesture = await tester.startGesture(
      tester.getCenter(find.text('First')),
    );
    await tester.pump(const Duration(milliseconds: 700));
    await gesture.moveTo(
      tester.getCenter(find.byKey(const ValueKey('board:work'))),
    );
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();
    expect(jsonDecode(library.saved!)['todos'][0]['groupId'], 'work');
    final handle = find.descendant(
      of: find.byKey(const ValueKey('board:home')),
      matching: find.byIcon(Icons.drag_handle),
    );
    final groupGesture = await tester.startGesture(tester.getCenter(handle));
    await tester.pump(const Duration(milliseconds: 700));
    await groupGesture.moveTo(
      tester.getCenter(find.byKey(const ValueKey('board:work'))),
    );
    await tester.pump();
    await groupGesture.up();
    await tester.pumpAndSettle();
    expect(
      (jsonDecode(library.saved!)['todoGroups'] as List).first['id'],
      'home',
    );
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
    library.dispose();
  });

  testWidgets('standalone todo notebook edits tasks without channel fields', (
    tester,
  ) async {
    final library = MemoryLibrary();
    final notebook = Notebook(
      id: 'standalone',
      name: 'Tasks',
      path: '/Tasks.todo.md',
      format: NotebookFormat.todo,
      noteBlocks: const [],
      content: jsonEncode({'version': 1, 'todos': [], 'todoGroups': []}),
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
              todoOnly: true,
              showDirectoryButton: false,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Chat'), findsNothing);
    await tester.enterText(find.byType(TextField).first, 'Finish report');
    await tester.tap(find.byTooltip('Add'));
    await tester.pumpAndSettle();
    final saved = jsonDecode(library.saved!) as Map<String, dynamic>;
    expect(saved['todos'][0]['text'], 'Finish report');
    expect(saved.containsKey('messages'), isFalse);
    expect(saved.containsKey('members'), isFalse);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
    library.dispose();
  });

  testWidgets(
    'channel settings can hide optional sections but retain required ones',
    (tester) async {
      final library = MemoryLibrary();
      final notebook = Notebook(
        id: 'settings',
        name: 'Settings test',
        path: '/Settings.channel.md',
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
      await tester.ensureVisible(find.widgetWithText(TextButton, 'Settings'));
      await tester.tap(find.widgetWithText(TextButton, 'Settings'));
      await tester.pumpAndSettle();
      final linksSwitch = find.widgetWithText(SwitchListTile, 'Links');
      expect(linksSwitch, findsOneWidget);
      await tester.tap(linksSwitch);
      await tester.pumpAndSettle();
      expect(
        jsonDecode(library.saved!)['enabledTabs'],
        isNot(contains('links')),
      );
      expect(find.widgetWithText(TextButton, 'Links'), findsNothing);
      expect(find.widgetWithText(TextButton, 'Chat'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'Members'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'Settings'), findsOneWidget);
      expect(
        tester
            .widget<SwitchListTile>(find.widgetWithText(SwitchListTile, 'Chat'))
            .onChanged,
        isNull,
      );
      await tester.pumpWidget(const SizedBox());
      controller.dispose();
      library.dispose();
    },
  );

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
