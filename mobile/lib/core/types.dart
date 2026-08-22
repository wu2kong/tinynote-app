enum ContentType {
  text,
  json,
  xml,
  ini,
  yaml,
  css,
  html,
  bash,
  shell,
  sql,
  javascript,
  typescript,
  python,
  java,
  go,
  rust,
  markdown,
}

ContentType contentTypeFromString(String value) {
  return ContentType.values.firstWhere(
    (type) => type.name == value,
    orElse: () => ContentType.text,
  );
}

class NoteBlock {
  const NoteBlock({
    required this.id,
    required this.title,
    required this.content,
    required this.contentType,
    required this.tags,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String title;
  final String content;
  final ContentType contentType;
  final List<String> tags;
  final String createdAt;
  final String updatedAt;
}

enum NotebookFormat { blocks, markdown, writer }

NotebookFormat detectNotebookFormat(String fileName) {
  final lower = fileName.toLowerCase();
  if (lower.endsWith('.writer.md')) return NotebookFormat.writer;
  if (lower.endsWith('.mk.md')) return NotebookFormat.markdown;
  return NotebookFormat.blocks;
}

String notebookDisplayName(String fileName) {
  final lower = fileName.toLowerCase();
  for (final suffix in ['.writer.md', '.mk.md', '.blk.md', '.md']) {
    if (lower.endsWith(suffix)) {
      return fileName.substring(0, fileName.length - suffix.length);
    }
  }
  return fileName;
}

class Notebook {
  const Notebook({
    required this.id,
    required this.name,
    required this.path,
    required this.noteBlocks,
    this.format = NotebookFormat.blocks,
    this.content,
  });

  final String id;
  final String name;
  final String path;
  final List<NoteBlock> noteBlocks;
  final NotebookFormat format;
  final String? content;
}

class Group {
  const Group({
    required this.id,
    required this.name,
    required this.path,
    required this.children,
    required this.notebookCount,
  });

  final String id;
  final String name;
  final String path;
  final List<LibraryItem> children;
  final int notebookCount;
}

class Space {
  const Space({
    required this.id,
    required this.name,
    required this.path,
    required this.groups,
  });

  final String id;
  final String name;
  final String path;
  final List<LibraryItem> groups;
}

sealed class LibraryItem {}

class GroupItem extends LibraryItem {
  GroupItem(this.group);
  final Group group;
}

class NotebookItem extends LibraryItem {
  NotebookItem(this.notebook);
  final Notebook notebook;
}

bool isGroupItem(LibraryItem item) => item is GroupItem;
bool isNotebookItem(LibraryItem item) => item is NotebookItem;
