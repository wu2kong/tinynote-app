import 'package:flutter_test/flutter_test.dart';
import 'package:tinynote_mobile/core/csv_table.dart';

void main() {
  test('parseCsv and serializeCsv round-trip', () {
    const raw = 'a,b,c\n"hello, world",x,y\n';
    expect(parseCsv(raw), [
      ['a', 'b', 'c'],
      ['hello, world', 'x', 'y'],
    ]);
    expect(serializeCsv(parseCsv(raw)), raw);
  });

  test('gridToMarkdownTable matches desktop shape', () {
    const grid = [
      ['Name', 'Value'],
      ['a', '1'],
    ];
    expect(
      gridToMarkdownTable(grid),
      '| Name | Value |\n| --- | --- |\n| a | 1 |',
    );
  });
}
