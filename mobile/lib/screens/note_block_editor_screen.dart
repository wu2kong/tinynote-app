import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/types.dart';
import '../services/library_service.dart';

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
  late final TextEditingController _titleController;
  late final TextEditingController _contentController;
  late final TextEditingController _tagsController;
  late ContentType _contentType;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.block.title);
    _contentController = TextEditingController(text: widget.block.content);
    _tagsController = TextEditingController(text: widget.block.tags.join(', '));
    _contentType = widget.block.contentType;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    _tagsController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      final tags = _tagsController.text
          .split(RegExp(r'[,，]'))
          .map((t) => t.trim())
          .where((t) => t.isNotEmpty)
          .toList();
      await widget.library.updateNoteBlock(
        widget.block.id,
        title: _titleController.text.trim().isEmpty
            ? 'Untitled'
            : _titleController.text.trim(),
        content: _contentController.text,
        contentType: _contentType,
        tags: tags,
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('保存失败：$error')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('删除笔记块'),
        content: Text('确定删除「${widget.block.title}」吗？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await widget.library.deleteNoteBlock(widget.block.id);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('删除失败：$error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(widget.isNew ? '新建笔记块' : '编辑笔记块'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        actions: [
          if (!widget.isNew)
            IconButton(
              tooltip: '删除',
              onPressed: _saving ? null : _delete,
              icon: const Icon(LucideIcons.trash2, size: 20, color: Color(0xFFEF4444)),
            ),
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('保存'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _titleController,
            decoration: const InputDecoration(
              labelText: '标题',
              border: OutlineInputBorder(),
              filled: true,
              fillColor: Colors.white,
            ),
          ),
          const SizedBox(height: 12),
          InputDecorator(
            decoration: const InputDecoration(
              labelText: '类型',
              border: OutlineInputBorder(),
              filled: true,
              fillColor: Colors.white,
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<ContentType>(
                value: _contentType,
                isExpanded: true,
                items: _editableContentTypes
                    .map(
                      (type) => DropdownMenuItem(
                        value: type,
                        child: Text(type.name),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() => _contentType = value);
                },
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _tagsController,
            decoration: const InputDecoration(
              labelText: '标签',
              hintText: '用逗号分隔，如 shell, git',
              border: OutlineInputBorder(),
              filled: true,
              fillColor: Colors.white,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _contentController,
            minLines: 12,
            maxLines: 24,
            style: const TextStyle(
              fontFamily: 'Menlo',
              fontSize: 14,
              height: 1.4,
            ),
            decoration: const InputDecoration(
              labelText: '内容',
              alignLabelWithHint: true,
              border: OutlineInputBorder(),
              filled: true,
              fillColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}
