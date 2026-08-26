import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/types.dart';
import '../l10n/l10n.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';
import '../utils/open_url.dart';
import 'app_toast.dart';

class DocumentNotebookView extends StatefulWidget {
  const DocumentNotebookView({
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

  @override
  State<DocumentNotebookView> createState() => _DocumentNotebookViewState();
}

class _DocumentNotebookViewState extends State<DocumentNotebookView> {
  late final TextEditingController _controller;
  var _editing = false;
  var _saving = false;
  var _dirty = false;
  String _syncedPath = '';
  String _syncedContent = '';

  LibraryService get library => widget.library;
  Notebook get notebook => widget.notebook;

  @override
  void initState() {
    super.initState();
    _syncedPath = notebook.path;
    _syncedContent = notebook.documentContent;
    _controller = TextEditingController(text: _syncedContent);
    _controller.addListener(_onTextChanged);
  }

  @override
  void didUpdateWidget(covariant DocumentNotebookView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (notebook.path != _syncedPath) {
      _syncedPath = notebook.path;
      _syncedContent = notebook.documentContent;
      _controller.text = _syncedContent;
      _editing = false;
      _dirty = false;
      _saving = false;
      return;
    }
    if (!_dirty && !_editing && notebook.documentContent != _syncedContent) {
      _syncedContent = notebook.documentContent;
      _controller.text = _syncedContent;
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_onTextChanged);
    _controller.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    final next = _controller.text != _syncedContent;
    if (next != _dirty) {
      setState(() => _dirty = next);
    }
  }

  Future<bool> _persist() async {
    final content = _controller.text;
    await library.updateNotebookContent(content);
    _syncedContent = content;
    _dirty = false;
    return true;
  }

  Future<void> _save({bool keepEditing = true}) async {
    if (_saving || !_dirty) return;
    setState(() => _saving = true);
    try {
      await _persist();
      if (!mounted) return;
      setState(() => _editing = keepEditing);
      if (!keepEditing) {
        showAppToast(context, context.s.documentSaved);
      }
    } catch (error) {
      if (!mounted) return;
      showAppToast(
        context,
        context.s.fill(context.s.saveFailed, {'error': '$error'}),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _enterEdit() async {
    setState(() => _editing = true);
  }

  Future<void> _enterPreview() async {
    if (_dirty) {
      await _save(keepEditing: false);
      return;
    }
    setState(() => _editing = false);
  }

  Future<void> _copyContent() async {
    final text = _editing ? _controller.text : notebook.documentContent;
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    showAppToast(context, context.s.commonCopiedContent);
  }

  Future<void> _openLink(String? href) async {
    if (href == null || !isExternalHref(href)) return;
    final opened = await openExternalUrl(href);
    if (!opened && mounted) {
      showAppToast(context, context.s.openLinkFailed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Row(
              children: [
                if (widget.showDirectoryButton) ...[
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
                        widget.spaceName,
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
                        widget.breadcrumb,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12, color: colors.muted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _ModeToggle(
                  editing: _editing,
                  onPreview: _enterPreview,
                  onEdit: _enterEdit,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 12, 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
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
                  tooltip: s.commonCopyContent,
                  visualDensity: VisualDensity.compact,
                  onPressed: _copyContent,
                  icon: Icon(
                    LucideIcons.copy,
                    size: 16,
                    color: colors.muted,
                  ),
                ),
                if (_editing)
                  TextButton(
                    onPressed: _saving || !_dirty ? null : () => _save(),
                    child:
                        _saving
                            ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                            : Text(_dirty ? s.commonSave : s.documentSaved),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: colors.accent,
              onRefresh: () => library.selectNotebook(notebook),
              child:
                  _editing
                      ? Padding(
                        padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + bottomInset),
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: colors.surface,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: colors.border),
                          ),
                          child: TextField(
                            controller: _controller,
                            maxLines: null,
                            expands: true,
                            textAlignVertical: TextAlignVertical.top,
                            style: TextStyle(
                              fontSize: 15,
                              height: 1.55,
                              color: colors.title,
                            ),
                            decoration: InputDecoration(
                              hintText: s.documentContentHint,
                              hintStyle: TextStyle(color: colors.muted),
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.all(16),
                            ),
                          ),
                        ),
                      )
                      : notebook.documentContent.trim().isEmpty
                      ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          const SizedBox(height: 80),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 32),
                            child: Text(
                              s.documentContentHint,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 15,
                                height: 1.5,
                                color: colors.muted,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Center(
                            child: OutlinedButton.icon(
                              onPressed: _enterEdit,
                              icon: const Icon(LucideIcons.penLine, size: 16),
                              label: Text(s.commonEdit),
                            ),
                          ),
                        ],
                      )
                      : Markdown(
                        data: notebook.documentContent,
                        selectable: true,
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
                        styleSheet: _markdownStyle(context),
                        onTapLink: (text, href, title) => _openLink(href),
                      ),
            ),
          ),
        ],
      ),
    );
  }

  MarkdownStyleSheet _markdownStyle(BuildContext context) {
    final colors = context.colors;
    final base = MarkdownStyleSheet.fromTheme(Theme.of(context));
    return base.copyWith(
      p: TextStyle(fontSize: 16, height: 1.65, color: colors.title),
      h1: TextStyle(
        fontSize: 26,
        fontWeight: FontWeight.w800,
        color: colors.title,
        height: 1.3,
      ),
      h2: TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        color: colors.title,
        height: 1.35,
      ),
      h3: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: colors.title,
        height: 1.4,
      ),
      a: TextStyle(
        color: colors.accent,
        decoration: TextDecoration.underline,
        decorationColor: colors.accent,
      ),
      blockquote: TextStyle(
        fontSize: 15,
        height: 1.55,
        color: colors.body,
        fontStyle: FontStyle.italic,
      ),
      blockquoteDecoration: BoxDecoration(
        color: colors.hover,
        border: Border(left: BorderSide(color: colors.accent, width: 3)),
      ),
      code: TextStyle(
        fontSize: 13.5,
        color: colors.codeFg,
        backgroundColor: colors.codeBg,
        fontFamily: 'Menlo',
      ),
      codeblockDecoration: BoxDecoration(
        color: colors.codeBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.border),
      ),
      listBullet: TextStyle(color: colors.accent, fontSize: 16),
      horizontalRuleDecoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.border)),
      ),
    );
  }
}

class _ModeToggle extends StatelessWidget {
  const _ModeToggle({
    required this.editing,
    required this.onPreview,
    required this.onEdit,
  });

  final bool editing;
  final VoidCallback onPreview;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ModeChip(
            label: s.previewDocument,
            selected: !editing,
            onTap: onPreview,
          ),
          _ModeChip(
            label: s.commonEdit,
            selected: editing,
            onTap: onEdit,
          ),
        ],
      ),
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      color: selected ? colors.accentSoft : Colors.transparent,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: selected ? null : onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: selected ? colors.accent : colors.body,
            ),
          ),
        ),
      ),
    );
  }
}
