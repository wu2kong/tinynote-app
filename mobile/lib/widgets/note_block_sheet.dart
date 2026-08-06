import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/types.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';
import '../screens/note_block_editor_screen.dart';
import 'app_context_menu.dart';
import 'app_toast.dart';
import 'sheet_drag_area.dart';

const _previewSize = 0.72;
const _fullSize = 1.0;

Future<void> showNoteBlockSheet({
  required BuildContext context,
  required LibraryService library,
  required NoteBlock block,
  required String breadcrumb,
  required String spaceName,
  Future<void> Function(NoteBlock block)? onDeleted,
}) {
  // ModalBottomSheet(useSafeArea:false) runs MediaQuery.removePadding(removeTop),
  // which zeros BOTH padding.top and viewPadding.top inside the sheet. Keep the
  // host safe-area insets so full-screen mode can clear the status bar.
  final hostPadding = MediaQuery.paddingOf(context);
  final hostViewPadding = MediaQuery.viewPaddingOf(context);

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    isDismissible: true,
    enableDrag: true,
    useSafeArea: false,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.35),
    builder: (context) {
      return MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(padding: hostPadding, viewPadding: hostViewPadding),
        child: NoteBlockSheet(
          library: library,
          block: block,
          breadcrumb: breadcrumb,
          spaceName: spaceName,
          onDeleted: onDeleted,
        ),
      );
    },
  );
}

class NoteBlockSheet extends StatefulWidget {
  const NoteBlockSheet({
    super.key,
    required this.library,
    required this.block,
    required this.breadcrumb,
    required this.spaceName,
    this.onDeleted,
  });

  final LibraryService library;
  final NoteBlock block;
  final String breadcrumb;
  final String spaceName;
  final Future<void> Function(NoteBlock block)? onDeleted;

  @override
  State<NoteBlockSheet> createState() => _NoteBlockSheetState();
}

class _NoteBlockSheetState extends State<NoteBlockSheet> {
  final _sheetController = DraggableScrollableController();
  late NoteBlock _block;
  var _isFull = false;

  @override
  void initState() {
    super.initState();
    _block = widget.block;
    _sheetController.addListener(_onSheetSizeChanged);
  }

  @override
  void dispose() {
    _sheetController.removeListener(_onSheetSizeChanged);
    _sheetController.dispose();
    super.dispose();
  }

  void _onSheetSizeChanged() {
    if (!_sheetController.isAttached) return;
    final nextFull = _sheetController.size >= 0.92;
    if (nextFull != _isFull) {
      setState(() => _isFull = nextFull);
    }
  }

  Future<void> _expandToFull() async {
    await _sheetController.animateTo(
      _fullSize,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _collapseToPreview() async {
    await _sheetController.animateTo(
      _previewSize,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
    );
  }

  void _copyContent({String label = '已复制内容'}) {
    Clipboard.setData(ClipboardData(text: _block.content));
    showAppToast(context, label);
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
    } else if (mounted) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _deleteBlock() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        final colors = context.colors;
        return AlertDialog(
          title: const Text('删除笔记块'),
          content: Text('确定删除「${_block.title}」吗？'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('取消'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: colors.danger),
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('删除'),
            ),
          ],
        );
      },
    );
    if (confirmed != true || !mounted) return;

    try {
      await widget.library.deleteNoteBlock(_block.id);
      await widget.onDeleted?.call(_block);
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('删除失败：$error')));
    }
  }

  Future<void> _showMoreMenu() async {
    final action = await showAppContextMenu<String>(
      context: context,
      items: const [
        AppContextMenuItem(
          value: 'edit',
          label: '编辑',
          icon: LucideIcons.pencil,
        ),
        AppContextMenuItem(
          value: 'copy',
          label: '复制内容',
          icon: LucideIcons.copy,
        ),
        AppContextMenuItem(
          value: 'delete',
          label: '删除',
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
    final media = MediaQuery.of(context);
    final topInset =
        media.padding.top > 0 ? media.padding.top : media.viewPadding.top;
    final bottomInset =
        media.padding.bottom > 0
            ? media.padding.bottom
            : media.viewPadding.bottom;
    final snippetLabel = _snippetLabel(_block.contentType);

    return DismissibleSheetScaffold(
      sheet: DraggableScrollableSheet(
        controller: _sheetController,
        expand: false,
        initialChildSize: _previewSize,
        minChildSize: 0.42,
        maxChildSize: _fullSize,
        snap: true,
        snapSizes: const [_previewSize, _fullSize],
        builder: (context, scrollController) {
          return AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius:
                  _isFull
                      ? BorderRadius.zero
                      : const BorderRadius.vertical(top: Radius.circular(28)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 24,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              children: [
                SheetDragArea(
                  controller: _sheetController,
                  minChildSize: 0.42,
                  maxChildSize: _fullSize,
                  snapSizes: const [_previewSize, _fullSize],
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(height: _isFull ? topInset + 4 : 10),
                      _SheetHeader(
                        isFull: _isFull,
                        showHandle: !_isFull,
                        onExpandHintTap: _expandToFull,
                        onCollapseHintTap: _collapseToPreview,
                        onCopy: () => _copyContent(),
                        onClose: () => Navigator.of(context).pop(),
                        onBackToList: () => Navigator.of(context).pop(),
                        onDelete: _deleteBlock,
                        onMore: _showMoreMenu,
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    controller: scrollController,
                    padding: EdgeInsets.fromLTRB(20, 8, 20, 24 + bottomInset),
                    children: [
                      Text(
                        _isFull
                            ? '${widget.spaceName} · ${widget.breadcrumb}'
                            : widget.breadcrumb,
                        style: TextStyle(fontSize: 12, color: colors.muted),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        _block.title,
                        style: TextStyle(
                          fontSize: _isFull ? 28 : 26,
                          fontWeight: FontWeight.w800,
                          color: colors.title,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 18),
                      _SnippetCard(
                        label: snippetLabel,
                        content: _block.content,
                        copyLabel: _isFull ? '一键复制' : '复制',
                        tinted: _isFull,
                        onCopy: () => _copyContent(label: '已复制内容'),
                      ),
                      if (_isFull) ...[
                        const SizedBox(height: 28),
                        Text(
                          '笔记管理',
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
                                label: '编辑',
                                onTap: _openEditor,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _ManageButton(
                                icon: LucideIcons.copy,
                                label: '复制',
                                onTap: () => _copyContent(),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _ManageButton(
                                icon: LucideIcons.trash2,
                                label: '删除',
                                danger: true,
                                onTap: _deleteBlock,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SheetHeader extends StatelessWidget {
  const _SheetHeader({
    required this.isFull,
    required this.showHandle,
    required this.onExpandHintTap,
    required this.onCollapseHintTap,
    required this.onCopy,
    required this.onClose,
    required this.onBackToList,
    required this.onDelete,
    required this.onMore,
  });

  final bool isFull;
  final bool showHandle;
  final VoidCallback onExpandHintTap;
  final VoidCallback onCollapseHintTap;
  final VoidCallback onCopy;
  final VoidCallback onClose;
  final VoidCallback onBackToList;
  final VoidCallback onDelete;
  final VoidCallback onMore;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 12, 4),
      child: Column(
        children: [
          if (showHandle) ...[
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(height: 8),
          ],
          if (!isFull)
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: onExpandHintTap,
                    behavior: HitTestBehavior.opaque,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            LucideIcons.chevronUp,
                            size: 16,
                            color: colors.muted,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '上拉打开详情',
                            style: TextStyle(fontSize: 13, color: colors.muted),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                _HeaderIconButton(icon: LucideIcons.copy, onTap: onCopy),
                const SizedBox(width: 8),
                _HeaderIconButton(icon: LucideIcons.x, onTap: onClose),
              ],
            )
          else
            Row(
              children: [
                TextButton.icon(
                  onPressed: onBackToList,
                  style: TextButton.styleFrom(
                    foregroundColor: colors.title,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                  ),
                  icon: const Icon(LucideIcons.chevronLeft, size: 18),
                  label: const Text('列表'),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: onCollapseHintTap,
                    behavior: HitTestBehavior.opaque,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Text(
                        '下拉返回预览',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: colors.muted),
                      ),
                    ),
                  ),
                ),
                _HeaderIconButton(icon: LucideIcons.copy, onTap: onCopy),
                const SizedBox(width: 8),
                _HeaderIconButton(
                  icon: LucideIcons.trash2,
                  onTap: onDelete,
                  background: colors.dangerSoft,
                  iconColor: colors.danger,
                ),
                const SizedBox(width: 8),
                _HeaderIconButton(icon: LucideIcons.ellipsis, onTap: onMore),
              ],
            ),
        ],
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
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
      color: background ?? colors.background,
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
    this.tinted = false,
  });

  final String label;
  final String content;
  final String copyLabel;
  final VoidCallback onCopy;
  final bool tinted;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: tinted ? colors.accentSoft : colors.hover,
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
            TextSpan(children: _highlightContent(content, colors)),
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

String _snippetLabel(ContentType type) {
  switch (type) {
    case ContentType.bash:
    case ContentType.shell:
      return '命令片段';
    case ContentType.markdown:
    case ContentType.text:
      return '内容';
    default:
      return '代码片段';
  }
}

List<InlineSpan> _highlightContent(String content, AppPalette colors) {
  if (content.trim().isEmpty) {
    return [TextSpan(text: '（空内容）', style: TextStyle(color: colors.muted))];
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
