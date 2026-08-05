import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/file_system.dart';
import '../core/types.dart';
import '../screens/settings_screen.dart';
import '../services/library_service.dart';
import 'name_prompt_dialog.dart';

class LibraryDrawer extends StatelessWidget {
  const LibraryDrawer({super.key, required this.library});

  final LibraryService library;

  Future<void> _handleError(BuildContext context, Object error) async {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$error')),
    );
  }

  static const _createSpaceValue = '__create_space__';

  Future<void> _createSpace(BuildContext context) async {
    final name = await showNamePromptDialog(
      context,
      title: '新建空间',
      hint: '空间名称',
      confirmLabel: '新建',
    );
    if (name == null || !context.mounted) return;
    try {
      await library.createSpace(name);
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _onSpaceDropdownChanged(BuildContext context, String? value) async {
    if (value == null) return;
    if (value == _createSpaceValue) {
      await _createSpace(context);
      return;
    }
    for (final space in library.spaces) {
      if (space.id == value) {
        await library.selectSpace(space);
        return;
      }
    }
  }

  Future<void> _showSpacePicker(BuildContext context) async {
    if (library.loading) return;
    final currentId = library.currentSpace?.id;
    final value = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 14, 16, 6),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  '切换空间',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                    color: Color(0xFF94A3B8),
                  ),
                ),
              ),
            ),
            for (final space in library.spaces)
              ListTile(
                dense: true,
                visualDensity: const VisualDensity(horizontal: 0, vertical: -2),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                leading: Icon(
                  LucideIcons.box,
                  size: 16,
                  color: space.id == currentId
                      ? const Color(0xFF0F766E)
                      : const Color(0xFF64748B),
                ),
                title: Text(
                  '${space.name} · ${countNotebooks(space.groups)} 本',
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: space.id == currentId ? FontWeight.w700 : FontWeight.w500,
                    color: space.id == currentId
                        ? const Color(0xFF0F766E)
                        : const Color(0xFF0F172A),
                  ),
                ),
                trailing: space.id == currentId
                    ? const Icon(LucideIcons.check, size: 16, color: Color(0xFF0F766E))
                    : null,
                onTap: () => Navigator.of(context).pop(space.id),
              ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),
            ListTile(
              dense: true,
              visualDensity: const VisualDensity(horizontal: 0, vertical: -2),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16),
              leading: const Icon(LucideIcons.plus, size: 16, color: Color(0xFF0F766E)),
              title: const Text(
                '新建空间',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF0F766E),
                ),
              ),
              onTap: () => Navigator.of(context).pop(_createSpaceValue),
            ),
            const SizedBox(height: 4),
          ],
        ),
      ),
    );
    if (!context.mounted || value == null) return;
    await _onSpaceDropdownChanged(context, value);
  }

  Future<void> _createGroup(BuildContext context, String parentPath) async {
    final name = await showNamePromptDialog(
      context,
      title: '新建目录',
      hint: '目录名称',
      confirmLabel: '新建',
    );
    if (name == null || !context.mounted) return;
    try {
      await library.createGroup(parentPath, name);
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _createNotebook(BuildContext context, String parentPath) async {
    final name = await showNamePromptDialog(
      context,
      title: '新建笔记本',
      hint: '笔记本名称',
      confirmLabel: '新建',
    );
    if (name == null || !context.mounted) return;
    try {
      await library.createNotebook(parentPath, name);
      if (context.mounted) Navigator.of(context).pop();
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _renameGroup(BuildContext context, Group group) async {
    final name = await showNamePromptDialog(
      context,
      title: '重命名目录',
      initialValue: group.name,
      confirmLabel: '保存',
    );
    if (name == null || name == group.name || !context.mounted) return;
    try {
      await library.renameGroup(group, name);
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _renameNotebook(BuildContext context, Notebook notebook) async {
    final name = await showNamePromptDialog(
      context,
      title: '重命名笔记本',
      initialValue: notebook.name,
      confirmLabel: '保存',
    );
    if (name == null || name == notebook.name || !context.mounted) return;
    try {
      await library.renameNotebook(notebook, name);
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _showCreateMenu(BuildContext context, String parentPath) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(LucideIcons.folderPlus, size: 20),
              title: const Text('新建目录'),
              onTap: () => Navigator.of(context).pop('group'),
            ),
            ListTile(
              leading: const Icon(LucideIcons.filePlus, size: 20),
              title: const Text('新建笔记本'),
              onTap: () => Navigator.of(context).pop('notebook'),
            ),
          ],
        ),
      ),
    );
    if (!context.mounted || action == null) return;
    if (action == 'group') {
      await _createGroup(context, parentPath);
    } else if (action == 'notebook') {
      await _createNotebook(context, parentPath);
    }
  }

  Future<void> _showGroupMenu(BuildContext context, Group group) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(group.name, style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: const Text('目录操作'),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(LucideIcons.folderPlus, size: 20),
              title: const Text('新建子目录'),
              onTap: () => Navigator.of(context).pop('group'),
            ),
            ListTile(
              leading: const Icon(LucideIcons.filePlus, size: 20),
              title: const Text('新建笔记本'),
              onTap: () => Navigator.of(context).pop('notebook'),
            ),
            ListTile(
              leading: const Icon(LucideIcons.pencil, size: 20),
              title: const Text('重命名'),
              onTap: () => Navigator.of(context).pop('rename'),
            ),
          ],
        ),
      ),
    );
    if (!context.mounted || action == null) return;
    switch (action) {
      case 'group':
        await _createGroup(context, group.path);
      case 'notebook':
        await _createNotebook(context, group.path);
      case 'rename':
        await _renameGroup(context, group);
    }
  }

  Future<void> _showNotebookMenu(BuildContext context, Notebook notebook) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(notebook.name, style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: const Text('笔记本操作'),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(LucideIcons.pencil, size: 20),
              title: const Text('重命名'),
              onTap: () => Navigator.of(context).pop('rename'),
            ),
          ],
        ),
      ),
    );
    if (!context.mounted || action == null) return;
    if (action == 'rename') {
      await _renameNotebook(context, notebook);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentSpace = library.currentSpace;

    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'TinyNote 轻记',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            '零碎笔记整理',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF0F766E),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: '刷新',
                    onPressed: library.loading ? null : library.refresh,
                    icon: library.loading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(LucideIcons.refreshCw, size: 18, color: Color(0xFF64748B)),
                  ),
                  IconButton(
                    tooltip: '设置中心',
                    onPressed: () => showSettingsSheet(context: context, library: library),
                    icon: const Icon(LucideIcons.settings, size: 18, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(bottom: 24),
                children: [
                  const _SectionLabel('空间'),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Material(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: library.loading ? null : () => _showSpacePicker(context),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  currentSpace?.name ?? '选择空间',
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: currentSpace == null
                                        ? const Color(0xFF94A3B8)
                                        : const Color(0xFF0F172A),
                                  ),
                                ),
                              ),
                              if (currentSpace != null) ...[
                                Text(
                                  '${countNotebooks(currentSpace.groups)} 本',
                                  style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                ),
                                const SizedBox(width: 6),
                              ],
                              Icon(
                                LucideIcons.chevronDown,
                                size: 18,
                                color: library.loading
                                    ? const Color(0xFFCBD5E1)
                                    : const Color(0xFF64748B),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  const Divider(height: 1, color: Color(0xFFE2E8F0)),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 8, 0),
                    child: Row(
                      children: [
                        const Expanded(
                          child: Text(
                            '目录',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.4,
                              color: Color(0xFF94A3B8),
                            ),
                          ),
                        ),
                        if (currentSpace != null)
                          IconButton(
                            tooltip: '新建',
                            visualDensity: VisualDensity.compact,
                            onPressed: () => _showCreateMenu(context, currentSpace.path),
                            icon: const Icon(LucideIcons.plus, size: 18, color: Color(0xFF0F766E)),
                          ),
                      ],
                    ),
                  ),
                  if (currentSpace == null)
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Text(
                        '选择一个空间以浏览目录',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                      ),
                    )
                  else if (currentSpace.groups.isEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '此空间为空',
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                          ),
                          const SizedBox(height: 8),
                          TextButton.icon(
                            onPressed: () => _showCreateMenu(context, currentSpace.path),
                            icon: const Icon(LucideIcons.plus, size: 16),
                            label: const Text('新建目录或笔记本'),
                          ),
                        ],
                      ),
                    )
                  else
                    ..._buildTree(context, currentSpace.groups, 0),
                ],
              ),
            ),
            if (library.storagePath != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Text(
                  '库路径：${library.storagePath}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                ),
              ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildTree(BuildContext context, List<LibraryItem> items, int depth) {
    final widgets = <Widget>[];
    for (final item in items) {
      if (item is GroupItem) {
        final group = item.group;
        final expanded = library.isGroupExpanded(group.path);
        widgets.add(
          InkWell(
            onTap: () => library.toggleExpandedGroup(group.path),
            onLongPress: () => _showGroupMenu(context, group),
            child: Padding(
              padding: EdgeInsets.only(left: 12 + depth * 14.0, right: 4),
              child: SizedBox(
                height: 44,
                child: Row(
                  children: [
                    Icon(
                      expanded ? LucideIcons.chevronDown : LucideIcons.chevronRight,
                      size: 16,
                      color: const Color(0xFF94A3B8),
                    ),
                    const SizedBox(width: 4),
                    const Icon(LucideIcons.folder, size: 16, color: Color(0xFF64748B)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        group.name,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '${group.notebookCount}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                    ),
                    IconButton(
                      tooltip: '更多',
                      visualDensity: VisualDensity.compact,
                      iconSize: 16,
                      onPressed: () => _showGroupMenu(context, group),
                      icon: const Icon(LucideIcons.ellipsis, size: 16, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
        if (expanded) {
          widgets.addAll(_buildTree(context, group.children, depth + 1));
        }
      } else if (item is NotebookItem) {
        final notebook = item.notebook;
        final selected = library.currentNotebook?.path == notebook.path;
        widgets.add(
          Material(
            color: selected ? const Color(0xFFEFF6FF) : Colors.transparent,
            child: InkWell(
              onTap: () async {
                await library.selectNotebook(notebook);
                if (context.mounted) {
                  Navigator.of(context).pop();
                }
              },
              onLongPress: () => _showNotebookMenu(context, notebook),
              child: Padding(
                padding: EdgeInsets.only(left: 12 + depth * 14.0 + 22, right: 4),
                child: SizedBox(
                  height: 44,
                  child: Row(
                    children: [
                      Icon(
                        LucideIcons.fileText,
                        size: 16,
                        color: selected ? const Color(0xFF0F766E) : const Color(0xFF64748B),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          notebook.name,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                            color: selected
                                ? const Color(0xFF0F766E)
                                : const Color(0xFF0F172A),
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: '更多',
                        visualDensity: VisualDensity.compact,
                        iconSize: 16,
                        onPressed: () => _showNotebookMenu(context, notebook),
                        icon: const Icon(LucideIcons.ellipsis, size: 16, color: Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      }
    }
    return widgets;
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
          color: Color(0xFF94A3B8),
        ),
      ),
    );
  }
}
