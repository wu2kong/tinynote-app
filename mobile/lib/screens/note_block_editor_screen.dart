import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/types.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';
import '../widgets/app_toast.dart';
import '../widgets/sheet_drag_area.dart';

const _editorPreviewSize = 0.92;
const _editorFullSize = 1.0;

const _editableContentTypes = <ContentType>[
  ContentType.text,
  ContentType.markdown,
  ContentType.bash,
  ContentType.shell,
  ContentType.json,
  ContentType.yaml,
  ContentType.sql,
  ContentType.javascript,
  ContentType.typescript,
  ContentType.python,
  ContentType.go,
  ContentType.rust,
  ContentType.java,
  ContentType.html,
  ContentType.css,
  ContentType.xml,
  ContentType.ini,
];

Future<bool?> showNoteBlockEditorSheet({
  required BuildContext context,
  required LibraryService library,
  required NoteBlock block,
  bool isNew = false,
}) {
  final hostPadding = MediaQuery.paddingOf(context);
  final hostViewPadding = MediaQuery.viewPaddingOf(context);

  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    isDismissible: true,
    enableDrag: true,
    useSafeArea: false,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.35),
    builder: (context) {
      return MediaQuery(
        data: MediaQuery.of(context).copyWith(
          padding: hostPadding,
          viewPadding: hostViewPadding,
        ),
        child: NoteBlockEditorScreen(
          library: library,
          block: block,
          isNew: isNew,
        ),
      );
    },
  );
}

class NoteBlockEditorScreen extends StatefulWidget {
  const NoteBlockEditorScreen({
    super.key,
    required this.library,
    required this.block,
    this.isNew = false,
  });

  final LibraryService library;
  final NoteBlock block;
  final bool isNew;

  @override
  State<NoteBlockEditorScreen> createState() => _NoteBlockEditorScreenState();
}

class _NoteBlockEditorScreenState extends State<NoteBlockEditorScreen> {
  final _sheetController = DraggableScrollableController();
  final _contentFocus = FocusNode();
  late final TextEditingController _titleController;
  late final TextEditingController _contentController;
  late final TextEditingController _tagsController;
  late ContentType _contentType;
  bool _saving = false;
  bool _dirty = false;
  bool _allowPop = false;
  var _isFull = false;

  @override
  void initState() {
    super.initState();
    final initialTitle =
        widget.isNew && widget.block.title == 'Untitled' ? '' : widget.block.title;
    _titleController = TextEditingController(text: initialTitle);
    _contentController = TextEditingController(text: widget.block.content);
    _tagsController = TextEditingController(text: widget.block.tags.join(', '));
    _contentType = widget.block.contentType;
    _titleController.addListener(_syncDirty);
    _contentController.addListener(_syncDirty);
    _tagsController.addListener(_syncDirty);
    _sheetController.addListener(_onSheetSizeChanged);
  }

  @override
  void dispose() {
    _sheetController.removeListener(_onSheetSizeChanged);
    _sheetController.dispose();
    _contentFocus.dispose();
    _titleController.removeListener(_syncDirty);
    _contentController.removeListener(_syncDirty);
    _tagsController.removeListener(_syncDirty);
    _titleController.dispose();
    _contentController.dispose();
    _tagsController.dispose();
    super.dispose();
  }

  void _onSheetSizeChanged() {
    if (!_sheetController.isAttached) return;
    final nextFull = _sheetController.size >= 0.96;
    if (nextFull != _isFull) {
      setState(() => _isFull = nextFull);
    }
  }

  List<String> _parseTags() {
    return _tagsController.text
        .split(RegExp(r'[,，]'))
        .map((t) => t.trim())
        .where((t) => t.isNotEmpty)
        .toList();
  }

  String get _normalizedTitle {
    final title = _titleController.text.trim();
    return title.isEmpty ? 'Untitled' : title;
  }

  bool _computeDirty() {
    return _normalizedTitle != widget.block.title ||
        _contentController.text != widget.block.content ||
        _contentType != widget.block.contentType ||
        !listEquals(_parseTags(), widget.block.tags);
  }

  void _syncDirty() {
    final next = _computeDirty();
    if (next != _dirty) {
      setState(() => _dirty = next);
    }
  }

  Future<bool> _persist() async {
    final tags = _parseTags();
    if (widget.isNew) {
      await widget.library.addNoteBlock(
        existing: widget.block,
        title: _normalizedTitle,
        content: _contentController.text,
        contentType: _contentType,
        tags: tags,
      );
    } else {
      await widget.library.updateNoteBlock(
        widget.block.id,
        title: _normalizedTitle,
        content: _contentController.text,
        contentType: _contentType,
        tags: tags,
      );
    }
    return true;
  }

  Future<void> _popWith(bool? result) async {
    if (!mounted) return;
    setState(() => _allowPop = true);
    await WidgetsBinding.instance.endOfFrame;
    if (mounted) Navigator.of(context).pop(result);
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await _persist();
      await _popWith(true);
    } catch (error) {
      if (!mounted) return;
      showAppToast(context, '保存失败：$error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _handlePop(Object? result) async {
    if (_saving) return;

    if (widget.isNew && _dirty) {
      setState(() => _saving = true);
      try {
        await _persist();
        await _popWith(true);
      } catch (error) {
        if (!mounted) return;
        showAppToast(context, '保存失败：$error');
      } finally {
        if (mounted) setState(() => _saving = false);
      }
      return;
    }

    await _popWith(result is bool ? result : null);
  }

  Future<void> _requestClose() => _handlePop(null);

  Future<void> _pasteClipboard() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text?.trimRight();
    if (!mounted) return;
    if (text == null || text.isEmpty) {
      showAppToast(context, '剪贴板为空');
      return;
    }

    final current = _contentController.text;
    final next = current.trim().isEmpty ? text : '$current\n\n$text';
    _contentController.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: next.length),
    );
    _contentFocus.requestFocus();
    showAppToast(context, '已粘贴剪贴板内容');
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        final colors = context.colors;
        return AlertDialog(
          title: const Text('删除笔记块'),
          content: Text('确定删除「${widget.block.title}」吗？'),
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
      await widget.library.deleteNoteBlock(widget.block.id);
      await _popWith(true);
    } catch (error) {
      if (!mounted) return;
      showAppToast(context, '删除失败：$error');
    }
  }

  InputDecoration _fieldDecoration(
    AppPalette colors, {
    String? hint,
    EdgeInsetsGeometry? contentPadding,
  }) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: colors.muted, fontSize: 15),
      filled: true,
      fillColor: colors.background,
      contentPadding: contentPadding ?? const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: colors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: colors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: colors.accent, width: 1.4),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final media = MediaQuery.of(context);
    final topInset = media.padding.top > 0 ? media.padding.top : media.viewPadding.top;
    final bottomInset =
        media.padding.bottom > 0 ? media.padding.bottom : media.viewPadding.bottom;
    final keyboardInset = media.viewInsets.bottom;
    final blockPop = _allowPop || !(widget.isNew && _dirty);

    return PopScope(
      canPop: blockPop,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        await _handlePop(result);
      },
      child: Padding(
        padding: EdgeInsets.only(bottom: keyboardInset),
        child: DismissibleSheetScaffold(
          sheet: DraggableScrollableSheet(
            controller: _sheetController,
            expand: false,
            initialChildSize: _editorPreviewSize,
            minChildSize: 0.55,
            maxChildSize: _editorFullSize,
            snap: true,
            snapSizes: const [_editorPreviewSize, _editorFullSize],
            builder: (context, scrollController) {
              return AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: _isFull
                      ? BorderRadius.zero
                      : const BorderRadius.vertical(top: Radius.circular(22)),
                ),
                child: Column(
                  children: [
                    SheetDragArea(
                      controller: _sheetController,
                      minChildSize: 0.55,
                      maxChildSize: _editorFullSize,
                      snapSizes: const [_editorPreviewSize, _editorFullSize],
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(height: _isFull ? topInset + 4 : 8),
                          if (!_isFull)
                            Container(
                              width: 36,
                              height: 4,
                              decoration: BoxDecoration(
                                color: colors.border,
                                borderRadius: BorderRadius.circular(999),
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(8, 8, 12, 10),
                            child: Row(
                              children: [
                                IconButton(
                                  tooltip: '关闭',
                                  visualDensity: VisualDensity.compact,
                                  onPressed: _saving ? null : _requestClose,
                                  icon: Icon(LucideIcons.x, size: 20, color: colors.muted),
                                ),
                                Expanded(
                                  child: Text(
                                    widget.isNew ? '新建笔记块' : '编辑笔记块',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w700,
                                      color: colors.title,
                                    ),
                                  ),
                                ),
                                if (!widget.isNew)
                                  IconButton(
                                    tooltip: '删除',
                                    visualDensity: VisualDensity.compact,
                                    onPressed: _saving ? null : _delete,
                                    icon: Icon(
                                      LucideIcons.trash2,
                                      size: 18,
                                      color: colors.danger,
                                    ),
                                  ),
                                const SizedBox(width: 4),
                                _SaveButton(saving: _saving, onPressed: _save),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: ListView(
                        controller: scrollController,
                        padding: EdgeInsets.fromLTRB(
                          16,
                          4,
                          16,
                          widget.isNew ? 12 : 20 + bottomInset,
                        ),
                        children: [
                          TextField(
                            controller: _titleController,
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: colors.title,
                              height: 1.25,
                            ),
                            textInputAction: TextInputAction.next,
                            decoration: _fieldDecoration(
                              colors,
                              hint: '标题',
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 16,
                              ),
                            ).copyWith(
                              fillColor: colors.background,
                            ),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            '类型',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: colors.muted,
                            ),
                          ),
                          const SizedBox(height: 8),
                          SizedBox(
                            height: 36,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: _editableContentTypes.length,
                              separatorBuilder: (_, _) => const SizedBox(width: 8),
                              itemBuilder: (context, index) {
                                final type = _editableContentTypes[index];
                                final selected = type == _contentType;
                                return ChoiceChip(
                                  label: Text(type.name),
                                  selected: selected,
                                  showCheckmark: false,
                                  visualDensity: VisualDensity.compact,
                                  labelStyle: TextStyle(
                                    fontSize: 13,
                                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                                    color: selected ? colors.accent : colors.body,
                                  ),
                                  selectedColor: colors.accentSoft,
                                  backgroundColor: colors.background,
                                  side: BorderSide(
                                    color: selected ? colors.accent.withValues(alpha: 0.35) : colors.border,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  onSelected: (_) {
                                    setState(() => _contentType = type);
                                    _syncDirty();
                                  },
                                );
                              },
                            ),
                          ),
                          const SizedBox(height: 14),
                          TextField(
                            controller: _tagsController,
                            style: TextStyle(fontSize: 14, color: colors.title),
                            decoration: _fieldDecoration(
                              colors,
                              hint: '标签，用逗号分隔',
                            ).copyWith(
                              prefixIcon: Icon(
                                LucideIcons.tags,
                                size: 16,
                                color: colors.muted,
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            '内容',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: colors.muted,
                            ),
                          ),
                          const SizedBox(height: 8),
                          DecoratedBox(
                            decoration: BoxDecoration(
                              color: colors.codeBg,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: colors.border),
                            ),
                            child: TextField(
                              controller: _contentController,
                              focusNode: _contentFocus,
                              minLines: 14,
                              maxLines: 28,
                              style: TextStyle(
                                fontFamily: 'Menlo',
                                fontSize: 14,
                                height: 1.5,
                                color: colors.codeFg,
                              ),
                              cursorColor: colors.accent,
                              decoration: InputDecoration(
                                hintText: widget.isNew ? '写下命令、片段或备忘…' : null,
                                hintStyle: TextStyle(
                                  fontFamily: 'Menlo',
                                  fontSize: 14,
                                  color: colors.muted,
                                ),
                                border: InputBorder.none,
                                contentPadding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (widget.isNew)
                      _PasteBar(
                        bottomInset: bottomInset,
                        enabled: !_saving,
                        onPaste: _pasteClipboard,
                      ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _SaveButton extends StatelessWidget {
  const _SaveButton({required this.saving, required this.onPressed});

  final bool saving;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      color: colors.accent,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: saving ? null : onPressed,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text(
                  '保存',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
        ),
      ),
    );
  }
}

class _PasteBar extends StatelessWidget {
  const _PasteBar({
    required this.bottomInset,
    required this.enabled,
    required this.onPaste,
  });

  final double bottomInset;
  final bool enabled;
  final VoidCallback onPaste;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(16, 10, 16, 12 + bottomInset),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.border)),
      ),
      child: Material(
        color: colors.accentSoft,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: enabled ? onPaste : null,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(LucideIcons.clipboardPaste, size: 18, color: colors.accent),
                const SizedBox(width: 8),
                Text(
                  '一键粘贴剪贴板内容',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: colors.accent,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
