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
