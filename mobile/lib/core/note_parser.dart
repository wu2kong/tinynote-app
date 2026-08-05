import 'types.dart';
import 'stable_id.dart';

bool _isBlockStart(List<String> lines, int pos) {
  if (lines[pos].trim() != '---') return false;

  var i = pos + 1;
  var foundClosing = false;
  var hasYamlKey = false;
  var lineCount = 0;

  while (i < lines.length && lineCount < 50) {
    lineCount++;
    final line = lines[i].trim();
    if (line == '---') {
      foundClosing = true;
      break;
    }
    if (line.startsWith('title:') ||
        line.startsWith('tags:') ||
        line.startsWith('contentType:') ||
        line.startsWith('createdAt:') ||
        line.startsWith('updatedAt:')) {
      hasYamlKey = true;
    }
    i++;
  }

  return hasYamlKey && foundClosing;
}

List<NoteBlock> parseNoteBlocks(String content, {String? notebookPath}) {
  final blocks = <NoteBlock>[];
  final lines = content.split('\n');
  var pos = 0;

  while (pos < lines.length) {
    while (pos < lines.length && lines[pos].trim().isEmpty) {
      pos++;
    }
    if (pos >= lines.length) break;

    if (lines[pos].trim() != '---') {
      pos++;
      continue;
    }
    pos++;

    final fmLines = <String>[];
    while (pos < lines.length && lines[pos].trim() != '---') {
      fmLines.add(lines[pos]);
      pos++;
    }
    if (pos >= lines.length) break;
    pos++;

    final frontmatter = fmLines.join('\n');
    final titleMatch = RegExp(r'^title:\s*(.+)$', multiLine: true).firstMatch(frontmatter);
    final tagsMatch = RegExp(r'^tags:\s*\[(.+)\]$', multiLine: true).firstMatch(frontmatter);
    final contentTypeMatch = RegExp(r'^contentType:\s*(.+)$', multiLine: true).firstMatch(frontmatter);
    final createdAtMatch = RegExp(r'^createdAt:\s*(.+)$', multiLine: true).firstMatch(frontmatter);
    final updatedAtMatch = RegExp(r'^updatedAt:\s*(.+)$', multiLine: true).firstMatch(frontmatter);

    final title = titleMatch?.group(1)?.trim() ?? 'Untitled';
    final tags = tagsMatch != null
        ? tagsMatch.group(1)!.split(',').map((t) => t.trim()).where((t) => t.isNotEmpty).toList()
        : <String>[];
    final contentType = contentTypeFromString(contentTypeMatch?.group(1)?.trim() ?? 'text');
    final now = DateTime.now().toUtc().toIso8601String();
    final createdAt = createdAtMatch?.group(1)?.trim() ?? now;
    final updatedAt = updatedAtMatch?.group(1)?.trim() ?? createdAt;

    final bodyLines = <String>[];
    while (pos < lines.length) {
      if (lines[pos].trim() == '---' && _isBlockStart(lines, pos)) {
        break;
      }
      bodyLines.add(lines[pos]);
      pos++;
    }

    var bodyContent = bodyLines.join('\n');
    bodyContent = bodyContent.replaceAll(RegExp(r'\n+$'), '');

    blocks.add(
      NoteBlock(
        id: notebookPath != null
            ? stableNoteBlockId(notebookPath, blocks.length, createdAt)
            : stableIdFromParts(['block', blocks.length.toString(), createdAt, title]),
        title: title,
        content: bodyContent,
        contentType: contentType,
        tags: tags,
        createdAt: createdAt,
        updatedAt: updatedAt,
      ),
    );
  }

  return blocks;
}

String serializeNoteBlocks(List<NoteBlock> blocks) {
  return blocks.map((block) {
    final tags = block.tags.isNotEmpty ? '[${block.tags.join(', ')}]' : '[]';
    final content = block.content.replaceAll(RegExp(r'^\n+|\n+$'), '');
    return '---\n'
        'title: ${block.title}\n'
        'contentType: ${block.contentType.name}\n'
        'tags: $tags\n'
        'createdAt: ${block.createdAt}\n'
        'updatedAt: ${block.updatedAt}\n'
        '---\n'
        '$content';
  }).join('\n\n');
}

NoteBlock createNoteBlock({
  String? title,
  String? content,
  ContentType contentType = ContentType.text,
  List<String>? tags,
}) {
  final now = DateTime.now().toUtc().toIso8601String();
  final resolvedTitle = title ?? 'Untitled';
  return NoteBlock(
    id: stableIdFromParts(['draft', now, resolvedTitle]),
    title: resolvedTitle,
    content: content ?? '',
    contentType: contentType,
    tags: tags ?? const [],
    createdAt: now,
    updatedAt: now,
  );
}
