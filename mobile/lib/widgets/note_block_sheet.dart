import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/types.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';
import '../screens/note_block_editor_screen.dart';
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
    useSafeArea: false,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.35),
    builder: (context) {
      return MediaQuery(
        data: MediaQuery.of(context).copyWith(
          padding: hostPadding,
          viewPadding: hostViewPadding,
        ),
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
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(label), duration: const Duration(milliseconds: 1200)),
    );
  }

  Future<void> _openEditor() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => NoteBlockEditorScreen(
          library: widget.library,
          block: _block,
        ),
      ),
    );
    final refreshed = widget.library.currentNotebook?.noteBlocks
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
      builder: (context) => AlertDialog(
        title: const Text('删除笔记块'),
        content: Text('确定删除「${_block.title}」吗？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('取消'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await widget.library.deleteNoteBlock(_block.id);
      await widget.onDeleted?.call(_block);
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('删除失败：$error')),
      );
    }
  }

  Future<void> _showMoreMenu() async {
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(LucideIcons.pencil, size: 20),
              title: const Text('编辑'),
              onTap: () => Navigator.of(context).pop('edit'),
            ),
            ListTile(
              leading: const Icon(LucideIcons.copy, size: 20),
              title: const Text('复制内容'),
              onTap: () => Navigator.of(context).pop('copy'),
            ),
            ListTile(
              leading: const Icon(LucideIcons.trash2, size: 20, color: AppColors.danger),
              title: const Text('删除', style: TextStyle(color: AppColors.danger)),
              onTap: () => Navigator.of(context).pop('delete'),
            ),
          ],
        ),
      ),
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
    final media = MediaQuery.of(context);
    final topInset = media.padding.top > 0 ? media.padding.top : media.viewPadding.top;
    final bottomInset =
        media.padding.bottom > 0 ? media.padding.bottom : media.viewPadding.bottom;
    final split = _splitContent(_block.content);
    final snippetLabel = _snippetLabel(_block.contentType);

    return DraggableScrollableSheet(
      controller: _sheetController,
      initialChildSize: _previewSize,
      minChildSize: 0.42,
      maxChildSize: _fullSize,
      snap: true,
      snapSizes: const [_previewSize, _fullSize],
      builder: (context, scrollController) {
        return AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: _isFull
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
                      _isFull ? '${widget.spaceName} · ${widget.breadcrumb}' : widget.breadcrumb,
                      style: const TextStyle(fontSize: 12, color: AppColors.muted),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _block.title,
                      style: TextStyle(
                        fontSize: _isFull ? 28 : 26,
                        fontWeight: FontWeight.w800,
                        color: AppColors.title,
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: 18),
                    _SnippetCard(
                      label: snippetLabel,
                      content: split.code,
                      copyLabel: _isFull ? '一键复制' : '复制',
                      tinted: _isFull,
                      onCopy: () => _copyContent(label: '已复制命令片段'),
                    ),
                    if (split.remark != null && split.remark!.trim().isNotEmpty) ...[
                      const SizedBox(height: 20),
                      const Text(
                        '备注',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.muted,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        split.remark!,
                        style: const TextStyle(
                          fontSize: 15,
                          height: 1.55,
                          color: AppColors.title,
                        ),
                      ),
                    ] else if (!_isFull && _block.content.trim().isNotEmpty) ...[
                      // preview already shows content in snippet; no extra remark
                    ],
                    if (_isFull) ...[
                      const SizedBox(height: 28),
                      const Text(
                        '笔记管理',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.muted,
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 12, 4),
      child: Column(
        children: [
          if (showHandle) ...[
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFD1D5DB),
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
                    child: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(LucideIcons.chevronUp, size: 16, color: AppColors.muted),
                          SizedBox(width: 4),
                          Text(
                            '上拉打开详情',
                            style: TextStyle(fontSize: 13, color: AppColors.muted),
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
                    foregroundColor: AppColors.title,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                  ),
                  icon: const Icon(LucideIcons.chevronLeft, size: 18),
                  label: const Text('列表'),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: onCollapseHintTap,
                    behavior: HitTestBehavior.opaque,
                    child: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 6),
                      child: Text(
                        '下拉返回预览',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: AppColors.muted),
                      ),
                    ),
                  ),
                ),
                _HeaderIconButton(icon: LucideIcons.copy, onTap: onCopy),
                const SizedBox(width: 8),
                _HeaderIconButton(
                  icon: LucideIcons.trash2,
                  onTap: onDelete,
                  background: const Color(0xFFFEE2E2),
                  iconColor: AppColors.danger,
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
    this.background = AppColors.background,
    this.iconColor = AppColors.title,
  });

  final IconData icon;
  final VoidCallback onTap;
  final Color background;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: background,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 18, color: iconColor),
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: tinted ? AppColors.accentSoft : const Color(0xFFF3F4F6),
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
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.muted,
                  ),
                ),
              ),
              Material(
                color: AppColors.accent,
                borderRadius: BorderRadius.circular(10),
                child: InkWell(
                  onTap: onCopy,
                  borderRadius: BorderRadius.circular(10),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(LucideIcons.copy, size: 14, color: Colors.white),
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
            TextSpan(children: _highlightContent(content)),
            style: const TextStyle(
              fontFamily: 'Menlo',
              fontSize: 13.5,
              height: 1.55,
              color: AppColors.title,
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
    final fg = danger ? AppColors.danger : AppColors.title;
    final bg = danger ? const Color(0xFFFEE2E2) : AppColors.surface;
    final border = danger ? const Color(0xFFFECACA) : AppColors.border;

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

class _ContentSplit {
  const _ContentSplit({required this.code, this.remark});
  final String code;
  final String? remark;
}

_ContentSplit _splitContent(String content) {
  final trimmed = content.trimRight();
  if (trimmed.isEmpty) {
    return const _ContentSplit(code: '');
  }

  final parts = trimmed.split(RegExp(r'\n\s*\n'));
  if (parts.length < 2) {
    return _ContentSplit(code: trimmed);
  }

  final last = parts.last.trim();
  final looksLikeCode = RegExp(r'^[\s]*([$#]|//|/\*|\*|{|}|`)').hasMatch(last) ||
      last.contains('\n\$') ||
      last.contains('\n#');
  if (looksLikeCode || last.length < 8) {
    return _ContentSplit(code: trimmed);
  }

  final code = parts.sublist(0, parts.length - 1).join('\n\n').trimRight();
  return _ContentSplit(code: code, remark: last);
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

List<InlineSpan> _highlightContent(String content) {
  if (content.trim().isEmpty) {
    return const [TextSpan(text: '（空内容）', style: TextStyle(color: AppColors.muted))];
  }

  final spans = <InlineSpan>[];
  final lines = content.split('\n');
  for (var i = 0; i < lines.length; i++) {
    final line = lines[i];
    final trimmed = line.trimLeft();
    if (trimmed.startsWith('#')) {
      spans.add(TextSpan(text: line, style: const TextStyle(color: AppColors.muted)));
    } else if (trimmed.startsWith(r'$')) {
      final leading = line.substring(0, line.length - trimmed.length);
      spans.add(TextSpan(text: leading));
      spans.add(const TextSpan(text: r'$ ', style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w700)));
      spans.add(TextSpan(
        text: trimmed.length > 1 ? trimmed.substring(1).trimLeft() : '',
        style: const TextStyle(color: AppColors.accent),
      ));
    } else {
      spans.add(TextSpan(text: line));
    }
    if (i != lines.length - 1) {
      spans.add(const TextSpan(text: '\n'));
    }
  }
  return spans;
}
