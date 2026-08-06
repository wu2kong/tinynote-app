import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/global_search.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';

Future<GlobalSearchResult?> showGlobalSearchSheet({
  required BuildContext context,
  required LibraryService library,
}) {
  final hostPadding = MediaQuery.paddingOf(context);
  final hostViewPadding = MediaQuery.viewPaddingOf(context);
  final colors = context.colors;

  return showModalBottomSheet<GlobalSearchResult>(
    context: context,
    isScrollControlled: true,
    isDismissible: true,
    enableDrag: true,
    useSafeArea: false,
    backgroundColor: colors.surface,
    barrierColor: Colors.black.withValues(alpha: 0.35),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (context) {
      return MediaQuery(
        data: MediaQuery.of(context).copyWith(
          padding: hostPadding,
          viewPadding: hostViewPadding,
        ),
        child: GlobalSearchSheet(library: library),
      );
    },
  );
}

class GlobalSearchSheet extends StatefulWidget {
  const GlobalSearchSheet({super.key, required this.library});

  final LibraryService library;

  @override
  State<GlobalSearchSheet> createState() => _GlobalSearchSheetState();
}

class _GlobalSearchSheetState extends State<GlobalSearchSheet> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  var _filters = defaultSearchFilters;
  var _activeQuery = '';
  var _results = const <GlobalSearchResult>[];
  var _hasInput = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onInputChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _controller.removeListener(_onInputChanged);
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onInputChanged() {
    final next = _controller.text.isNotEmpty;
    if (next != _hasInput) {
      setState(() => _hasInput = next);
    }
  }

  void _runSearch() {
    final query = _controller.text.trim();
    setState(() {
      _activeQuery = query;
      _results = query.isEmpty
          ? const []
          : performGlobalSearch(widget.library.spaces, query, _filters);
    });
  }

  void _toggleFilter(SearchFilterKey key) {
    setState(() {
      _filters = _filters.toggled(key);
      if (_activeQuery.isNotEmpty) {
        _results = performGlobalSearch(
          widget.library.spaces,
          _activeQuery,
          _filters,
        );
      }
    });
  }

  void _clearInput() {
    _controller.clear();
    setState(() {
      _activeQuery = '';
      _results = const [];
    });
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final maxHeight = MediaQuery.sizeOf(context).height * 0.88;

    return SafeArea(
      child: SizedBox(
        height: maxHeight,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 8),
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: colors.background,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: colors.border),
                ),
                child: Row(
                  children: [
                    Icon(LucideIcons.search, size: 16, color: colors.muted),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        focusNode: _focusNode,
                        autofocus: true,
                        textInputAction: TextInputAction.search,
                        autocorrect: false,
                        enableSuggestions: false,
                        style: TextStyle(fontSize: 14, color: colors.title),
                        decoration: InputDecoration(
                          hintText: '全局搜索…',
                          hintStyle: TextStyle(color: colors.muted),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(
                            vertical: 12,
                          ),
                        ),
                        onSubmitted: (_) => _runSearch(),
                      ),
                    ),
                    if (_hasInput)
                      IconButton(
                        tooltip: '清空',
                        visualDensity: VisualDensity.compact,
                        onPressed: _clearInput,
                        icon: Icon(
                          LucideIcons.x,
                          size: 16,
                          color: colors.muted,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    '匹配范围：',
                    style: TextStyle(fontSize: 12, color: colors.body),
                  ),
                  for (final option in filterOptions)
                    _FilterChip(
                      label: option.$2,
                      checked: _filters[option.$1],
                      onTap: () => _toggleFilter(option.$1),
                    ),
                ],
              ),
            ),
            Divider(height: 1, color: colors.border),
            Expanded(
              child: _activeQuery.isEmpty
                  ? Center(
                      child: Text(
                        '输入关键词后按回车搜索',
                        style: TextStyle(fontSize: 13, color: colors.muted),
                      ),
                    )
                  : _results.isEmpty
                      ? Center(
                          child: Text(
                            '未找到匹配结果',
                            style: TextStyle(fontSize: 13, color: colors.muted),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(8, 8, 8, 16),
                          itemCount: _results.length,
                          itemBuilder: (context, index) {
                            final result = _results[index];
                            return _ResultTile(
                              result: result,
                              query: _activeQuery,
                              onTap: () => Navigator.of(context).pop(result),
                            );
                          },
                        ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Text(
                '按回车执行搜索',
                style: TextStyle(fontSize: 11, color: colors.muted),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.checked,
    required this.onTap,
  });

  final String label;
  final bool checked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      color: checked ? colors.accentSoft : colors.background,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: checked ? colors.accent.withValues(alpha: 0.35) : colors.border,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                checked ? LucideIcons.squareCheck : LucideIcons.square,
                size: 14,
                color: checked ? colors.accent : colors.muted,
              ),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: checked ? FontWeight.w600 : FontWeight.w500,
                  color: checked ? colors.accent : colors.body,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({
    required this.result,
    required this.query,
    required this.onTap,
  });

  final GlobalSearchResult result;
  final String query;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final parts = getResultTitleParts(result);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text.rich(
                TextSpan(
                  children: [
                    for (var i = 0; i < parts.length; i++) ...[
                      if (i > 0)
                        TextSpan(
                          text: ' / ',
                          style: TextStyle(color: colors.muted, fontSize: 13),
                        ),
                      ...splitHighlightSegments(parts[i], query).map(
                        (seg) => TextSpan(
                          text: seg.text,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: seg.highlight ? colors.danger : colors.title,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                result.matchLabels.join(' · '),
                style: TextStyle(
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  color: colors.muted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
