import '../core/types.dart';

/// Free tier: max number of spaces.
const freeMaxSpaces = 5;

/// Free tier: max notebooks inside a single space.
const freeMaxNotebooksPerSpace = 100;

/// Free tier: max trial notebooks per article format in a single space.
const freeMaxArticleNotebooksPerFormat = 1;

enum ProFeature {
  spaceLimit,
  notebookLimit,
  articleNotebook,
  sync,
}

class GateContext {
  const GateContext({required this.parentPath, required this.format});

  final String parentPath;
  final NotebookFormat format;
}

bool isArticleNotebookFormat(NotebookFormat format) {
  return format == NotebookFormat.markdown || format == NotebookFormat.writer;
}

int countLibraryItems(List<LibraryItem> items) {
  var count = 0;
  for (final item in items) {
    if (item is NotebookItem) {
      count += 1;
    } else if (item is GroupItem) {
      count += countLibraryItems(item.group.children);
    }
  }
  return count;
}

int countSpaceNotebooks(Space space) => countLibraryItems(space.groups);

List<Notebook> collectArticleNotebooks(
  List<LibraryItem> items, {
  NotebookFormat? format,
}) {
  final result = <Notebook>[];
  for (final item in items) {
    if (item is NotebookItem) {
      if (!isArticleNotebookFormat(item.notebook.format)) continue;
      if (format != null && item.notebook.format != format) continue;
      result.add(item.notebook);
    } else if (item is GroupItem) {
      result.addAll(
        collectArticleNotebooks(item.group.children, format: format),
      );
    }
  }
  return result;
}

List<Notebook> collectSpaceArticleNotebooks(
  Space space, {
  NotebookFormat? format,
}) {
  return collectArticleNotebooks(space.groups, format: format);
}
