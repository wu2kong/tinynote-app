import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:tinynote_mobile/main.dart';

void main() {
  testWidgets('App builds MaterialApp', (WidgetTester tester) async {
    await tester.pumpWidget(const TinyNoteApp());
    expect(find.byType(MaterialApp), findsOneWidget);
    await tester.pump();
  });
}
