import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/types.dart';
import '../l10n/l10n.dart';
import '../screens/note_block_editor_screen.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';
import 'app_context_menu.dart';
import 'app_toast.dart';

/// Full-height note preview for wide (tablet) layouts — no bottom sheet chrome.
class NoteBlockDetailPane extends StatefulWidget {
  const NoteBlockDetailPane({
    super.key,
    required this.library,
    required this.block,
    required this.breadcrumb,
    required this.spaceName,
    this.onDeleted,
    this.onChanged,
  });

  final LibraryService library;
  final NoteBlock block;
  final String breadcrumb;
  final String spaceName;
  final Future<void> Function(NoteBlock block)? onDeleted;
  final ValueChanged<NoteBlock>? onChanged;

  @override
  State<NoteBlockDetailPane> createState() => _NoteBlockDetailPaneState();
}

class _NoteBlockDetailPaneState extends State<NoteBlockDetailPane> {
  late NoteBlock _block;

  @override
  void initState() {
    super.initState();
    _block = widget.block;
  }

  @override
  void didUpdateWidget(covariant NoteBlockDetailPane oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.block.id != _block.id || widget.block != _block) {
      _block = widget.block;
    }
  }

  void _copyContent({String? label}) {
    Clipboard.setData(ClipboardData(text: _block.content));
    showAppToast(context, label ?? context.s.commonCopiedContent);
  }

  Future<void> _openEditor() async {
    await showNoteBlockEditorSheet(
      context: context,
      library: widget.library,
      block: _block,
    );
    final refreshed =
        widget.library.currentNotebook?.noteBlocks
            .where((item) => item.id == _block.id)
            .firstOrNull;
    if (refreshed != null && mounted) {
      setState(() => _block = refreshed);
      widget.onChanged?.call(refreshed);
    } else if (mounted) {
      await widget.onDeleted?.call(_block);
    }
  }

  Future<void> _deleteBlock() async {
    final s = context.s;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        final colors = context.colors;
        return AlertDialog(
          title: Text(s.deleteNoteBlock),
          content: Text(
            s.fill(s.deleteNoteBlockMessage, {'name': _block.title}),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(s.commonCancel),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: colors.danger),
              onPressed: () => Navigator.of(context).pop(true),
              child: Text(s.commonDelete),
            ),
          ],
        );
      },
    );
    if (confirmed != true || !mounted) return;

    try {
      await widget.library.deleteNoteBlock(_block.id);
      await widget.onDeleted?.call(_block);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.fill(s.deleteFailed, {'error': '$error'}))),
      );
    }
  }

  Future<void> _showMoreMenu() async {
    final s = context.s;
    final action = await showAppContextMenu<String>(
      context: context,
      items: [
        AppContextMenuItem(
          value: 'edit',
          label: s.commonEdit,
          icon: LucideIcons.pencil,
        ),
        AppContextMenuItem(
          value: 'copy',
          label: s.commonCopyContent,
          icon: LucideIcons.copy,
        ),
        AppContextMenuItem(
          value: 'delete',
          label: s.commonDelete,
          icon: LucideIcons.trash2,
          danger: true,
        ),
      ],
    );
    if (!mounted || action == null) return;
    switch (action) {
      case 'edit':
        await _openEditor();
      case 'copy':
        _copyContent();
      case 'delete':
        await _deleteBlock();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final snippetLabel = _snippetLabel(_block.contentType, s);

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        left: false,
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 12, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${widget.spaceName} · ${widget.breadcrumb}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: colors.muted),
                    ),
                  ),
                  _PaneIconButton(
                    icon: LucideIcons.copy,
                    onTap: () => _copyContent(),
                  ),
                  const SizedBox(width: 8),
                  _PaneIconButton(
                    icon: LucideIcons.pencil,
                    onTap: _openEditor,
                  ),
                  const SizedBox(width: 8),
                  _PaneIconButton(
                    icon: LucideIcons.trash2,
                    onTap: _deleteBlock,
                    background: colors.dangerSoft,
                    iconColor: colors.danger,
                  ),
                  const SizedBox(width: 8),
                  _PaneIconButton(
                    icon: LucideIcons.ellipsis,
                    onTap: _showMoreMenu,
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: EdgeInsets.fromLTRB(24, 4, 24, 24 + bottomInset),
                children: [
                  Text(
                    _block.title,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      color: colors.title,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 18),
                  _SnippetCard(
                    label: snippetLabel,
                    content: _block.content,
                    copyLabel: s.oneTapCopy,
                    onCopy: () => _copyContent(label: s.commonCopiedContent),
                  ),
                  const SizedBox(height: 28),
                  Text(
                    s.noteManagement,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: colors.muted,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _ManageButton(
                          icon: LucideIcons.pencil,
                          label: s.commonEdit,
                          onTap: _openEditor,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _ManageButton(
                          icon: LucideIcons.copy,
                          label: s.commonCopy,
                          onTap: () => _copyContent(),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _ManageButton(
                          icon: LucideIcons.trash2,
                          label: s.commonDelete,
                          danger: true,
                          onTap: _deleteBlock,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class NoteBlockDetailEmpty extends StatelessWidget {
  const NoteBlockDetailEmpty({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;

    return ColoredBox(
      color: colors.background,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.fileText, size: 44, color: colors.muted),
              const SizedBox(height: 16),
              Text(
                s.selectNoteBlockHint,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: colors.title,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PaneIconButton extends StatelessWidget {
  const _PaneIconButton({
    required this.icon,
    required this.onTap,
    this.background,
    this.iconColor,
  });

  final IconData icon;
  final VoidCallback onTap;
  final Color? background;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Material(
      color: background ?? colors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 18, color: iconColor ?? colors.title),
        ),
      ),
    );
  }
}

class _SnippetCard extends StatelessWidget {
  const _SnippetCard({
    required this.label,
    required this.content,
    required this.copyLabel,
    required this.onCopy,
  });

  final String label;
  final String content;
  final String copyLabel;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: colors.accentSoft,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: colors.muted,
                  ),
                ),
              ),
              Material(
                color: colors.accent,
                borderRadius: BorderRadius.circular(10),
                child: InkWell(
                  onTap: onCopy,
                  borderRadius: BorderRadius.circular(10),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 7,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          LucideIcons.copy,
                          size: 14,
                          color: Colors.white,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          copyLabel,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SelectableText.rich(
            TextSpan(children: _highlightContent(content, colors, s)),
            style: TextStyle(
              fontFamily: 'Menlo',
              fontSize: 13.5,
              height: 1.55,
              color: colors.codeFg,
            ),
          ),
        ],
      ),
    );
  }
}

class _ManageButton extends StatelessWidget {
  const _ManageButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.danger = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final fg = danger ? colors.danger : colors.title;
    final bg = danger ? colors.dangerSoft : colors.surface;
    final border =
        danger ? colors.danger.withValues(alpha: 0.35) : colors.border;

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: border),
          ),
          child: Column(
            children: [
              Icon(icon, size: 20, color: fg),
              const SizedBox(height: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: fg,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _snippetLabel(ContentType type, AppStrings s) {
  switch (type) {
    case ContentType.bash:
    case ContentType.shell:
      return s.commandSnippet;
    case ContentType.markdown:
    case ContentType.text:
      return s.contentSnippet;
    default:
      return s.codeSnippet;
  }
}

List<InlineSpan> _highlightContent(
  String content,
  AppPalette colors,
  AppStrings s,
) {
  if (content.trim().isEmpty) {
    return [
      TextSpan(
        text: s.commonEmptyContent,
        style: TextStyle(color: colors.muted),
      ),
    ];
  }

  final spans = <InlineSpan>[];
  final lines = content.split('\n');
  for (var i = 0; i < lines.length; i++) {
    final line = lines[i];
    final trimmed = line.trimLeft();
    if (trimmed.startsWith('#')) {
      spans.add(TextSpan(text: line, style: TextStyle(color: colors.muted)));
    } else if (trimmed.startsWith(r'$')) {
      final leading = line.substring(0, line.length - trimmed.length);
      spans.add(TextSpan(text: leading));
      spans.add(
        TextSpan(
          text: r'$ ',
          style: TextStyle(color: colors.accent, fontWeight: FontWeight.w700),
        ),
      );
      spans.add(
        TextSpan(
          text: trimmed.length > 1 ? trimmed.substring(1).trimLeft() : '',
          style: TextStyle(color: colors.accent),
        ),
      );
    } else {
      spans.add(TextSpan(text: line));
    }
    if (i != lines.length - 1) {
      spans.add(const TextSpan(text: '\n'));
    }
  }
  return spans;
}
