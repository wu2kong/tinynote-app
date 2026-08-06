import '../l10n/l10n.dart';
import 'types.dart';

class SearchFilters {
  const SearchFilters({
    this.spaceName = false,
    this.notebookName = true,
    this.blockTitle = true,
    this.blockContent = false,
  });

  final bool spaceName;
  final bool notebookName;
  final bool blockTitle;
  final bool blockContent;

  SearchFilters copyWith({
    bool? spaceName,
    bool? notebookName,
    bool? blockTitle,
    bool? blockContent,
  }) {
    return SearchFilters(
      spaceName: spaceName ?? this.spaceName,
      notebookName: notebookName ?? this.notebookName,
      blockTitle: blockTitle ?? this.blockTitle,
      blockContent: blockContent ?? this.blockContent,
    );
  }

  bool operator [](SearchFilterKey key) {
    return switch (key) {
      SearchFilterKey.spaceName => spaceName,
      SearchFilterKey.notebookName => notebookName,
      SearchFilterKey.blockTitle => blockTitle,
      SearchFilterKey.blockContent => blockContent,
    };
  }

  SearchFilters toggled(SearchFilterKey key) {
    return switch (key) {
      SearchFilterKey.spaceName => copyWith(spaceName: !spaceName),
      SearchFilterKey.notebookName => copyWith(notebookName: !notebookName),
      SearchFilterKey.blockTitle => copyWith(blockTitle: !blockTitle),
      SearchFilterKey.blockContent => copyWith(blockContent: !blockContent),
    };
  }
}

enum SearchFilterKey { spaceName, notebookName, blockTitle, blockContent }

enum GlobalSearchResultType { space, notebook, noteBlock }

class GlobalSearchResult {
  const GlobalSearchResult({
    required this.id,
    required this.type,
    required this.matchLabels,
    required this.spaceName,
    required this.spacePath,
    this.notebookName,
    this.blockTitle,
    this.notebookPath,
    this.blockTitleKey,
  });

  final String id;
  final GlobalSearchResultType type;
  final List<String> matchLabels;
  final String spaceName;
  final String? notebookName;
  final String? blockTitle;
  final String spacePath;
  final String? notebookPath;
  final String? blockTitleKey;
}

class TextSegment {
  const TextSegment({required this.text, required this.highlight});

  final String text;
  final bool highlight;
}

const defaultSearchFilters = SearchFilters();

List<(SearchFilterKey, String)> searchFilterOptions(AppStrings s) => [
  (SearchFilterKey.spaceName, s.searchFilterSpaceName),
  (SearchFilterKey.notebookName, s.searchFilterNotebookName),
  (SearchFilterKey.blockTitle, s.searchFilterBlockTitle),
  (SearchFilterKey.blockContent, s.searchFilterBlockContent),
];

String searchFilterLabel(SearchFilterKey key, AppStrings s) {
  return switch (key) {
    SearchFilterKey.spaceName => s.searchFilterSpaceName,
    SearchFilterKey.notebookName => s.searchFilterNotebookName,
    SearchFilterKey.blockTitle => s.searchFilterBlockTitle,
    SearchFilterKey.blockContent => s.searchFilterBlockContent,
  };
}

bool _walkNotebooks(
  List<LibraryItem> items,
  bool Function(Notebook notebook) callback,
) {
  for (final item in items) {
    if (item is GroupItem) {
      if (_walkNotebooks(item.group.children, callback)) return true;
    } else if (item is NotebookItem) {
      if (callback(item.notebook)) return true;
    }
  }
  return false;
}

List<TextSegment> splitHighlightSegments(String text, String query) {
  final q = query.trim();
  if (q.isEmpty) return [TextSegment(text: text, highlight: false)];

  final lowerText = text.toLowerCase();
  final lowerQ = q.toLowerCase();
  final segments = <TextSegment>[];
  var lastIndex = 0;
  var index = lowerText.indexOf(lowerQ, lastIndex);

  while (index != -1) {
    if (index > lastIndex) {
      segments.add(
        TextSegment(text: text.substring(lastIndex, index), highlight: false),
      );
    }
    segments.add(
      TextSegment(
        text: text.substring(index, index + q.length),
        highlight: true,
      ),
    );
    lastIndex = index + q.length;
    index = lowerText.indexOf(lowerQ, lastIndex);
  }

  if (lastIndex < text.length) {
    segments.add(
      TextSegment(text: text.substring(lastIndex), highlight: false),
    );
  }

  return segments.isNotEmpty
      ? segments
      : [TextSegment(text: text, highlight: false)];
}

List<String> getResultTitleParts(GlobalSearchResult result) {
  final parts = <String>[result.spaceName];
  if (result.notebookName != null) parts.add(result.notebookName!);
  if (result.blockTitle != null) parts.add(result.blockTitle!);
  return parts;
}

List<GlobalSearchResult> performGlobalSearch(
  List<Space> spaces,
  String query,
  SearchFilters filters, {
  int maxResults = 50,
}) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return const [];

  final s = appStrings;
  final results = <GlobalSearchResult>[];

  for (final space in spaces) {
    if (filters.spaceName && space.name.toLowerCase().contains(q)) {
      results.add(
        GlobalSearchResult(
          id: 'space:${space.path}',
          type: GlobalSearchResultType.space,
          matchLabels: [searchFilterLabel(SearchFilterKey.spaceName, s)],
          spaceName: space.name,
          spacePath: space.path,
        ),
      );
      if (results.length >= maxResults) return results;
    }

    _walkNotebooks(space.groups, (notebook) {
      if (filters.notebookName && notebook.name.toLowerCase().contains(q)) {
        results.add(
          GlobalSearchResult(
            id: 'notebook:${notebook.path}',
            type: GlobalSearchResultType.notebook,
            matchLabels: [searchFilterLabel(SearchFilterKey.notebookName, s)],
            spaceName: space.name,
            notebookName: notebook.name,
            spacePath: space.path,
            notebookPath: notebook.path,
          ),
        );
        if (results.length >= maxResults) return true;
      }

      for (final block in notebook.noteBlocks) {
        final matchLabels = <String>[];
        if (filters.blockTitle && block.title.toLowerCase().contains(q)) {
          matchLabels.add(searchFilterLabel(SearchFilterKey.blockTitle, s));
        }
        if (filters.blockContent && block.content.toLowerCase().contains(q)) {
          matchLabels.add(searchFilterLabel(SearchFilterKey.blockContent, s));
        }
        if (matchLabels.isNotEmpty) {
          results.add(
            GlobalSearchResult(
              id: 'block:${notebook.path}:${block.title}',
              type: GlobalSearchResultType.noteBlock,
              matchLabels: matchLabels,
              spaceName: space.name,
              notebookName: notebook.name,
              blockTitle: block.title,
              spacePath: space.path,
              notebookPath: notebook.path,
              blockTitleKey: block.title,
            ),
          );
          if (results.length >= maxResults) return true;
        }
      }
      return false;
    });

    if (results.length >= maxResults) return results;
  }

  return results;
}
