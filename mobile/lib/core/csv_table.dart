/// CSV grid parse/serialize and Markdown table export (aligned with desktop `csvTable.ts`).

List<List<String>> parseCsv(String text) {
  final normalized = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  final rows = <List<String>>[];
  var row = <String>[];
  var field = '';
  var inQuotes = false;

  for (var i = 0; i < normalized.length; i++) {
    final c = normalized[i];
    if (inQuotes) {
      if (c == '"') {
        if (i + 1 < normalized.length && normalized[i + 1] == '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c == '"') {
      inQuotes = true;
      continue;
    }
    if (c == ',') {
      row.add(field);
      field = '';
      continue;
    }
    if (c == '\n') {
      row.add(field);
      field = '';
      rows.add(row);
      row = [];
      continue;
    }
    field += c;
  }

  row.add(field);
  if (row.length > 1 || row.first.isNotEmpty || rows.isEmpty) {
    rows.add(row);
  }

  return normalizeCsvRows(rows);
}

List<List<String>> normalizeCsvRows(List<List<String>> rows) {
  if (rows.isEmpty) return [
    ['']
  ];
  final maxCols = rows.map((r) => r.length).fold<int>(1, (a, b) => a > b ? a : b);
  return rows
      .map((r) {
        final copy = [...r];
        while (copy.length < maxCols) {
          copy.add('');
        }
        return copy;
      })
      .toList();
}

bool mustQuoteCsvField(String field) {
  return RegExp(r'[",\r\n\u2028\u2029]').hasMatch(field);
}

String escapeCsvField(String field) {
  if (!mustQuoteCsvField(field)) return field;
  final escaped = field
      .replaceAll('"', '""')
      .replaceAll('\r\n', '\n')
      .replaceAll('\r', '\n');
  return '"$escaped"';
}

String serializeCsv(List<List<String>> rows) {
  if (rows.isEmpty) return '';
  return '${rows.map((row) => row.map(escapeCsvField).join(',')).join('\n')}\n';
}

String _escapeMarkdownTableCell(String text) {
  return text
      .replaceAll(r'\', r'\\')
      .replaceAll('|', r'\|')
      .replaceAll('\r\n', '\n')
      .replaceAll('\n', '<br>');
}

String _formatMarkdownTableRow(List<String> cells) {
  return '| ${cells.map(_escapeMarkdownTableCell).join(' | ')} |';
}

/// GitHub-flavored Markdown pipe table from a CSV grid.
String gridToMarkdownTable(List<List<String>> rows) {
  if (rows.isEmpty) {
    return '| |\n| --- |\n';
  }
  final colCount = rows.map((r) => r.length).fold<int>(1, (a, b) => a > b ? a : b);
  final normalized = rows.map((row) {
    final copy = [...row];
    while (copy.length < colCount) {
      copy.add('');
    }
    return copy;
  }).toList();
  final separator = '| ${List.filled(colCount, '---').join(' | ')} |';
  return [
    _formatMarkdownTableRow(normalized.first),
    separator,
    ...normalized.skip(1).map(_formatMarkdownTableRow),
  ].join('\n');
}

final csvCellLinkPattern = RegExp(
  "(https?://[^\\s<]+[^\\s<.,;:!?'\"\\)\\]]|mailto:[^\\s<]+)",
  caseSensitive: false,
);
