import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/csv_table.dart';
import '../core/types.dart';
import '../l10n/l10n.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';
import '../utils/open_url.dart';
import 'app_toast.dart';

class CsvNotebookView extends StatelessWidget {
  const CsvNotebookView({
    super.key,
    required this.library,
    required this.notebook,
    required this.spaceName,
    required this.breadcrumb,
    this.showDirectoryButton = true,
  });

  final LibraryService library;
  final Notebook notebook;
  final String spaceName;
  final String breadcrumb;
  final bool showDirectoryButton;

  Future<void> _copyText(BuildContext context, String text, String successMessage) async {
    try {
      await Clipboard.setData(ClipboardData(text: text));
      if (context.mounted) showAppToast(context, successMessage);
    } catch (_) {
      if (context.mounted) showAppToast(context, context.s.copyFailed);
    }
  }

  Future<void> _openLink(BuildContext context, String href) async {
    if (!isExternalHref(href)) return;
    final opened = await openExternalUrl(href);
    if (!opened && context.mounted) {
      showAppToast(context, context.s.openLinkFailed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;
    final raw = notebook.documentContent;
    final grid = parseCsv(raw);
    final colCount = grid.first.length;

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Row(
              children: [
                if (showDirectoryButton) ...[
                  IconButton(
                    tooltip: s.openDirectory,
                    onPressed: () => Scaffold.of(context).openDrawer(),
                    style: IconButton.styleFrom(
                      backgroundColor: colors.surface,
                      side: BorderSide(color: colors.border),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    icon: Icon(
                      LucideIcons.panelLeft,
                      size: 20,
                      color: colors.title,
                    ),
                  ),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        spaceName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: colors.title,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        breadcrumb,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12, color: colors.muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 12, 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: colors.accentSoft,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    s.formatLabel(notebook.format),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: colors.accent,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    notebook.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: colors.body,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: s.csvPreviewCopyCsv,
                  visualDensity: VisualDensity.compact,
                  onPressed: () => _copyText(
                    context,
                    serializeCsv(grid),
                    s.csvPreviewCopiedCsv,
                  ),
                  icon: Icon(LucideIcons.fileText, size: 18, color: colors.muted),
                ),
                IconButton(
                  tooltip: s.csvPreviewCopyMarkdown,
                  visualDensity: VisualDensity.compact,
                  onPressed: () => _copyText(
                    context,
                    gridToMarkdownTable(grid),
                    s.csvPreviewCopiedMarkdown,
                  ),
                  icon: Icon(LucideIcons.table2, size: 18, color: colors.muted),
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: colors.accent,
              onRefresh: () => library.selectNotebook(notebook),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: colors.border),
                    ),
                    child: Table(
                      defaultColumnWidth: const FixedColumnWidth(112),
                      border: TableBorder.all(color: colors.border, width: 0.5),
                      children: [
                        for (var rowIndex = 0; rowIndex < grid.length; rowIndex++)
                          TableRow(
                            children: [
                              for (var colIndex = 0; colIndex < colCount; colIndex++)
                                _CsvPreviewCell(
                                  text: grid[rowIndex][colIndex],
                                  onOpenLink: (href) => _openLink(context, href),
                                ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CsvPreviewCell extends StatelessWidget {
  const _CsvPreviewCell({
    required this.text,
    required this.onOpenLink,
  });

  final String text;
  final void Function(String href) onOpenLink;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      child: Align(
        alignment: Alignment.centerLeft,
        child: _CsvLinkRichText(
          text: text,
          style: TextStyle(
            fontSize: 13,
            height: 1.35,
            color: colors.body,
          ),
          linkStyle: TextStyle(
            fontSize: 13,
            height: 1.35,
            color: colors.accent,
            decoration: TextDecoration.underline,
          ),
          onOpenLink: onOpenLink,
        ),
      ),
    );
  }
}

class _CsvLinkRichText extends StatefulWidget {
  const _CsvLinkRichText({
    required this.text,
    required this.style,
    required this.linkStyle,
    required this.onOpenLink,
  });

  final String text;
  final TextStyle style;
  final TextStyle linkStyle;
  final void Function(String href) onOpenLink;

  @override
  State<_CsvLinkRichText> createState() => _CsvLinkRichTextState();
}

class _CsvLinkRichTextState extends State<_CsvLinkRichText> {
  final _recognizers = <TapGestureRecognizer>[];

  @override
  void dispose() {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    _recognizers.clear();

    final spans = <InlineSpan>[];
    var lastIndex = 0;
    for (final match in csvCellLinkPattern.allMatches(widget.text)) {
      final href = match.group(0)!;
      final start = match.start;
      if (start > lastIndex) {
        spans.add(TextSpan(text: widget.text.substring(lastIndex, start), style: widget.style));
      }
      if (isExternalHref(href)) {
        final recognizer = TapGestureRecognizer()..onTap = () => widget.onOpenLink(href);
        _recognizers.add(recognizer);
        spans.add(
          TextSpan(
            text: href,
            style: widget.linkStyle,
            recognizer: recognizer,
          ),
        );
      } else {
        spans.add(TextSpan(text: href, style: widget.style));
      }
      lastIndex = match.end;
    }
    if (lastIndex < widget.text.length) {
      spans.add(TextSpan(text: widget.text.substring(lastIndex), style: widget.style));
    }
    if (spans.isEmpty) {
      spans.add(TextSpan(text: widget.text, style: widget.style));
    }

    return SelectableText.rich(TextSpan(children: spans));
  }
}
