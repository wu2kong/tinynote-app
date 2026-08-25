import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/file_system.dart';
import '../core/global_search.dart';
import '../core/types.dart';
import '../l10n/l10n.dart';
import '../screens/settings_screen.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';
import 'app_context_menu.dart';
import 'global_search_sheet.dart';
import 'import_notes_sheet.dart';
import 'name_prompt_dialog.dart';

class LibraryDrawer extends StatelessWidget {
  const LibraryDrawer({super.key, required this.library, this.onOpenNoteBlock});

  final LibraryService library;
  final ValueChanged<NoteBlock>? onOpenNoteBlock;

  Future<void> _handleError(BuildContext context, Object error) async {
    if (!context.mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('$error')));
  }

  static const _createSpaceValue = '__create_space__';

  Future<void> _createSpace(BuildContext context) async {
    final s = context.s;
    final name = await showNamePromptDialog(
      context,
      title: s.createSpace,
      hint: s.spaceName,
      confirmLabel: s.commonCreate,
    );
    if (name == null || !context.mounted) return;
    try {
      await library.createSpace(name);
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _onSpaceDropdownChanged(
    BuildContext context,
    String? value,
  ) async {
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
    final colors = context.colors;
    final s = context.s;
    final value = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: colors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) {
        return ListenableBuilder(
          listenable: library,
          builder: (context, _) {
            final colors = context.colors;
            final currentId = library.currentSpace?.id;
            final maxHeight = MediaQuery.sizeOf(context).height * 0.7;
            return SafeArea(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxHeight: maxHeight),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          s.switchSpace,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.3,
                            color: colors.muted,
                          ),
                        ),
                      ),
                    ),
                    Flexible(
                      child: ListView.builder(
                        shrinkWrap: true,
                        itemCount: library.spaces.length + 2,
                        itemBuilder: (itemContext, index) {
                          if (index < library.spaces.length) {
                            final space = library.spaces[index];
                            return GestureDetector(
                              onLongPressStart:
                                  (details) => _showSpaceMenu(
                                    context,
                                    space,
                                    menuContext: itemContext,
                                    sheetContext: sheetContext,
                                    globalPosition: details.globalPosition,
                                  ),
                              child: ListTile(
                                dense: true,
                                visualDensity: const VisualDensity(
                                  horizontal: 0,
                                  vertical: -2,
                                ),
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                ),
                                leading: Icon(
                                  LucideIcons.box,
                                  size: 16,
                                  color:
                                      space.id == currentId
                                          ? colors.accent
                                          : colors.body,
                                ),
                                title: Text(
                                  '${space.name} · ${s.fill(s.notebookCount, {'count': '${countNotebooks(space.groups)}'})}',
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight:
                                        space.id == currentId
                                            ? FontWeight.w700
                                            : FontWeight.w500,
                                    color:
                                        space.id == currentId
                                            ? colors.accent
                                            : colors.title,
                                  ),
                                ),
                                trailing:
                                    space.id == currentId
                                        ? Icon(
                                          LucideIcons.check,
                                          size: 16,
                                          color: colors.accent,
                                        )
                                        : null,
                                onTap:
                                    () => Navigator.of(
                                      sheetContext,
                                    ).pop(space.id),
                              ),
                            );
                          }
                          if (index == library.spaces.length) {
                            return Divider(height: 1, color: colors.border);
                          }
                          return Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              ListTile(
                                dense: true,
                                visualDensity: const VisualDensity(
                                  horizontal: 0,
                                  vertical: -2,
                                ),
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                ),
                                leading: Icon(
                                  LucideIcons.plus,
                                  size: 16,
                                  color: colors.accent,
                                ),
                                title: Text(
                                  s.createSpace,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: colors.accent,
                                  ),
                                ),
                                onTap:
                                    () => Navigator.of(
                                      sheetContext,
                                    ).pop(_createSpaceValue),
                              ),
                              const SizedBox(height: 4),
                            ],
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
    if (!context.mounted || value == null) return;
    await _onSpaceDropdownChanged(context, value);
  }

  Future<void> _showSpaceMenu(
    BuildContext context,
    Space space, {
    BuildContext? menuContext,
    BuildContext? sheetContext,
    Offset? globalPosition,
  }) async {
    final s = context.s;
    final action = await showAppContextMenu<String>(
      context: menuContext ?? context,
      globalPosition: globalPosition,
      items: [
        AppContextMenuItem(
          value: 'rename',
          label: s.renameSpace,
          icon: LucideIcons.pencil,
        ),
        AppContextMenuItem(
          value: 'delete',
          label: s.deleteSpace,
          icon: LucideIcons.trash2,
          danger: true,
        ),
      ],
    );
    if (!context.mounted || action == null) return;
    switch (action) {
      case 'rename':
        await _renameSpace(context, space);
      case 'delete':
        await _confirmDeleteSpace(context, space, sheetContext: sheetContext);
    }
  }

  Future<void> _renameSpace(BuildContext context, Space space) async {
    final s = context.s;
    final name = await showNamePromptDialog(
      context,
      title: s.renameSpace,
      initialValue: space.name,
      hint: s.spaceName,
      confirmLabel: s.commonSave,
    );
    if (name == null || name == space.name || !context.mounted) return;
    try {
      await library.renameSpace(space, name);
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _confirmDeleteSpace(
    BuildContext context,
    Space space, {
    BuildContext? sheetContext,
  }) async {
    final colors = context.colors;
    final s = context.s;
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: Text(s.deleteSpace),
            content: Text(s.fill(s.deleteSpaceMessage, {'name': space.name})),
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
          ),
    );
    if (confirmed != true || !context.mounted) return;
    try {
      await library.deleteSpace(space);
      if (sheetContext != null && sheetContext.mounted) {
        Navigator.of(sheetContext).pop();
      }
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _createGroup(BuildContext context, String parentPath) async {
    final s = context.s;
    final name = await showNamePromptDialog(
      context,
      title: s.createFolder,
      hint: s.folderName,
      confirmLabel: s.commonCreate,
    );
    if (name == null || !context.mounted) return;
    try {
      await library.createGroup(parentPath, name);
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _createNotebook(
    BuildContext context,
    String parentPath, {
    NotebookFormat format = NotebookFormat.blocks,
  }) async {
    final s = context.s;
    final title = switch (format) {
      NotebookFormat.blocks => s.createNotebook,
      NotebookFormat.markdown => s.createMarkdownNotebook,
      NotebookFormat.writer => s.createWriterNotebook,
    };
    final name = await showNamePromptDialog(
      context,
      title: title,
      hint: s.notebookName,
      confirmLabel: s.commonCreate,
    );
    if (name == null || !context.mounted) return;
    try {
      await library.createNotebook(parentPath, name, format: format);
      if (context.mounted) Navigator.of(context).pop();
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _renameGroup(BuildContext context, Group group) async {
    final s = context.s;
    final name = await showNamePromptDialog(
      context,
      title: s.renameFolder,
      initialValue: group.name,
      hint: s.folderName,
      confirmLabel: s.commonSave,
    );
    if (name == null || name == group.name || !context.mounted) return;
    try {
      await library.renameGroup(group, name);
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _renameNotebook(BuildContext context, Notebook notebook) async {
    final s = context.s;
    final name = await showNamePromptDialog(
      context,
      title: s.renameNotebook,
      initialValue: notebook.name,
      hint: s.notebookName,
      confirmLabel: s.commonSave,
    );
    if (name == null || name == notebook.name || !context.mounted) return;
    try {
      await library.renameNotebook(notebook, name);
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _confirmDeleteGroup(BuildContext context, Group group) async {
    final colors = context.colors;
    final s = context.s;
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: Text(s.deleteFolder),
            content: Text(s.fill(s.deleteFolderMessage, {'name': group.name})),
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
          ),
    );
    if (confirmed != true || !context.mounted) return;
    try {
      await library.deleteGroup(group);
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _confirmDeleteNotebook(
    BuildContext context,
    Notebook notebook,
  ) async {
    final colors = context.colors;
    final s = context.s;
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: Text(s.deleteNotebook),
            content: Text(
              s.fill(s.deleteNotebookMessage, {'name': notebook.name}),
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
          ),
    );
    if (confirmed != true || !context.mounted) return;
    try {
      await library.deleteNotebook(notebook);
    } catch (error) {
      if (context.mounted) await _handleError(context, error);
    }
  }

  Future<void> _openGlobalSearch(BuildContext context) async {
    final result = await showGlobalSearchSheet(
      context: context,
      library: library,
    );
    if (result == null || !context.mounted) return;

    final shouldCloseDrawer = result.type != GlobalSearchResultType.space;
    final block = await library.navigateToGlobalSearchResult(result);
    if (!context.mounted) return;

    if (shouldCloseDrawer) {
      Navigator.of(context).pop();
    }

    if (block != null && onOpenNoteBlock != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        onOpenNoteBlock!(block);
      });
    }
  }

  Future<void> _showCreateMenu(BuildContext context, String parentPath) async {
    final s = context.s;
    final action = await showAppContextMenu<String>(
      context: context,
      items: [
        AppContextMenuItem(
          value: 'group',
          label: s.createFolder,
          icon: LucideIcons.folderPlus,
        ),
        AppContextMenuItem(
          value: 'blocks',
          label: s.createNotebook,
          icon: LucideIcons.boxes,
        ),
        AppContextMenuItem(
          value: 'markdown',
          label: s.createMarkdownNotebook,
          icon: LucideIcons.fileCode,
        ),
        AppContextMenuItem(
          value: 'writer',
          label: s.createWriterNotebook,
          icon: LucideIcons.penLine,
        ),
        AppContextMenuItem(
          value: 'import',
          label: s.importNotes,
          icon: LucideIcons.fileInput,
        ),
      ],
    );
    if (!context.mounted || action == null) return;
    switch (action) {
      case 'group':
        await _createGroup(context, parentPath);
      case 'blocks':
        await _createNotebook(context, parentPath);
      case 'markdown':
        await _createNotebook(
          context,
          parentPath,
          format: NotebookFormat.markdown,
        );
      case 'writer':
        await _createNotebook(
          context,
          parentPath,
          format: NotebookFormat.writer,
        );
      case 'import':
        await showImportNotesSheet(context: context, library: library);
    }
  }

  Future<void> _showGroupMenu(
    BuildContext context,
    Group group, {
    Offset? globalPosition,
  }) async {
    final s = context.s;
    final action = await showAppContextMenu<String>(
      context: context,
      globalPosition: globalPosition,
      items: [
        AppContextMenuItem(
          value: 'group',
          label: s.createSubfolder,
          icon: LucideIcons.folderPlus,
        ),
        AppContextMenuItem(
          value: 'blocks',
          label: s.createNotebook,
          icon: LucideIcons.boxes,
        ),
        AppContextMenuItem(
          value: 'markdown',
          label: s.createMarkdownNotebook,
          icon: LucideIcons.fileCode,
        ),
        AppContextMenuItem(
          value: 'writer',
          label: s.createWriterNotebook,
          icon: LucideIcons.penLine,
        ),
        AppContextMenuItem(
          value: 'rename',
          label: s.commonRename,
          icon: LucideIcons.pencil,
        ),
        AppContextMenuItem(
          value: 'delete',
          label: s.deleteFolder,
          icon: LucideIcons.trash2,
          danger: true,
        ),
      ],
    );
    if (!context.mounted || action == null) return;
    switch (action) {
      case 'group':
        await _createGroup(context, group.path);
      case 'blocks':
        await _createNotebook(context, group.path);
      case 'markdown':
        await _createNotebook(
          context,
          group.path,
          format: NotebookFormat.markdown,
        );
      case 'writer':
        await _createNotebook(
          context,
          group.path,
          format: NotebookFormat.writer,
        );
      case 'rename':
        await _renameGroup(context, group);
      case 'delete':
        await _confirmDeleteGroup(context, group);
    }
  }

  Future<void> _showNotebookMenu(
    BuildContext context,
    Notebook notebook, {
    Offset? globalPosition,
  }) async {
    final s = context.s;
    final swap = notebook.format.swappableArticleFormat;
    final action = await showAppContextMenu<String>(
      context: context,
      globalPosition: globalPosition,
      items: [
        if (swap == NotebookFormat.markdown)
          AppContextMenuItem(
            value: 'convert',
            label: s.convertToMarkdown,
            icon: LucideIcons.fileCode,
          ),
        if (swap == NotebookFormat.writer)
          AppContextMenuItem(
            value: 'convert',
            label: s.convertToWriter,
            icon: LucideIcons.penLine,
          ),
        AppContextMenuItem(
          value: 'rename',
          label: s.commonRename,
          icon: LucideIcons.pencil,
        ),
        AppContextMenuItem(
          value: 'delete',
          label: s.deleteNotebook,
          icon: LucideIcons.trash2,
          danger: true,
        ),
      ],
    );
    if (!context.mounted || action == null) return;
    switch (action) {
      case 'convert':
        if (swap == null) return;
        try {
          await library.convertNotebookFormat(notebook, swap);
        } catch (error) {
          if (context.mounted) await _handleError(context, error);
        }
      case 'rename':
        await _renameNotebook(context, notebook);
      case 'delete':
        await _confirmDeleteNotebook(context, notebook);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;
    final currentSpace = library.currentSpace;

    return Drawer(
      backgroundColor: colors.surface,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 4, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            s.appTitle,
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: colors.title,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            s.appTagline,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: colors.accent,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _HeaderIconButton(
                        tooltip: s.commonRefresh,
                        onPressed: library.loading ? null : library.refresh,
                        icon:
                            library.loading
                                ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                                : Icon(
                                  LucideIcons.refreshCw,
                                  size: 18,
                                  color: colors.body,
                                ),
                      ),
                      _HeaderIconButton(
                        tooltip: s.globalSearch,
                        onPressed: () => _openGlobalSearch(context),
                        icon: Icon(
                          LucideIcons.search,
                          size: 18,
                          color: colors.body,
                        ),
                      ),
                      _HeaderIconButton(
                        tooltip: s.settingsCenter,
                        onPressed:
                            () => showSettingsSheet(
                              context: context,
                              library: library,
                            ),
                        icon: Icon(
                          LucideIcons.settings,
                          size: 18,
                          color: colors.body,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: colors.border),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(bottom: 24),
                children: [
                  _SectionLabel(s.spaceSection),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Material(
                      color: colors.background,
                      borderRadius: BorderRadius.circular(12),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap:
                            library.loading
                                ? null
                                : () => _showSpacePicker(context),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: colors.border),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  currentSpace?.name ?? s.chooseSpace,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color:
                                        currentSpace == null
                                            ? colors.muted
                                            : colors.title,
                                  ),
                                ),
                              ),
                              if (currentSpace != null) ...[
                                Text(
                                  s.fill(s.notebookCount, {
                                    'count':
                                        '${countNotebooks(currentSpace.groups)}',
                                  }),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: colors.muted,
                                  ),
                                ),
                                const SizedBox(width: 6),
                              ],
                              Icon(
                                LucideIcons.chevronDown,
                                size: 18,
                                color:
                                    library.loading
                                        ? colors.muted
                                        : colors.body,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  Divider(height: 1, color: colors.border),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 8, 0),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            s.foldersSection,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.4,
                              color: colors.muted,
                            ),
                          ),
                        ),
                        if (currentSpace != null)
                          IconButton(
                            tooltip: s.createNew,
                            visualDensity: VisualDensity.compact,
                            onPressed:
                                () =>
                                    _showCreateMenu(context, currentSpace.path),
                            icon: Icon(
                              LucideIcons.plus,
                              size: 18,
                              color: colors.accent,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (currentSpace == null)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      child: Text(
                        s.chooseSpaceToBrowse,
                        style: TextStyle(color: colors.muted, fontSize: 13),
                      ),
                    )
                  else if (currentSpace.groups.isEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            s.emptySpace,
                            style: TextStyle(color: colors.muted, fontSize: 13),
                          ),
                          const SizedBox(height: 8),
                          TextButton.icon(
                            onPressed:
                                () =>
                                    _showCreateMenu(context, currentSpace.path),
                            icon: const Icon(LucideIcons.plus, size: 16),
                            label: Text(s.createFolderOrNotebook),
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
                  s.fill(s.libraryPath, {'path': library.storagePath!}),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 10, color: colors.muted),
                ),
              ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildTree(
    BuildContext context,
    List<LibraryItem> items,
    int depth,
  ) {
    final colors = context.colors;
    final s = context.s;
    final widgets = <Widget>[];
    for (final item in items) {
      if (item is GroupItem) {
        final group = item.group;
        final expanded = library.isGroupExpanded(group.path);
        widgets.add(
          Builder(
            builder: (itemContext) {
              return InkWell(
                onTap: () => library.toggleExpandedGroup(group.path),
                onLongPress: () => _showGroupMenu(itemContext, group),
                child: Padding(
                  padding: EdgeInsets.only(left: 12 + depth * 14.0, right: 4),
                  child: SizedBox(
                    height: 44,
                    child: Row(
                      children: [
                        Icon(
                          expanded
                              ? LucideIcons.chevronDown
                              : LucideIcons.chevronRight,
                          size: 16,
                          color: colors.muted,
                        ),
                        const SizedBox(width: 4),
                        Icon(LucideIcons.folder, size: 16, color: colors.body),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            group.name,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              color: colors.title,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: colors.hover,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${group.notebookCount}',
                            style: TextStyle(fontSize: 11, color: colors.body),
                          ),
                        ),
                        IconButton(
                          tooltip: s.commonMore,
                          visualDensity: VisualDensity.compact,
                          iconSize: 16,
                          onPressed: () => _showGroupMenu(itemContext, group),
                          icon: Icon(
                            LucideIcons.ellipsis,
                            size: 16,
                            color: colors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        );
        if (expanded) {
          widgets.addAll(_buildTree(context, group.children, depth + 1));
        }
      } else if (item is NotebookItem) {
        final notebook = item.notebook;
        final selected = library.currentNotebook?.path == notebook.path;
        widgets.add(
          Builder(
            builder: (itemContext) {
              return Material(
                color: selected ? colors.accentSoft : Colors.transparent,
                child: InkWell(
                  onTap: () async {
                    await library.selectNotebook(notebook);
                    if (context.mounted) {
                      Navigator.of(context).pop();
                    }
                  },
                  onLongPress: () => _showNotebookMenu(itemContext, notebook),
                  child: Padding(
                    padding: EdgeInsets.only(
                      left: 12 + depth * 14.0 + 22,
                      right: 4,
                    ),
                    child: SizedBox(
                      height: 44,
                      child: Row(
                        children: [
                          Icon(
                            _notebookIcon(notebook.format),
                            size: 16,
                            color: selected ? colors.accent : colors.body,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              notebook.name,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight:
                                    selected
                                        ? FontWeight.w700
                                        : FontWeight.w500,
                                color: selected ? colors.accent : colors.title,
                              ),
                            ),
                          ),
                          IconButton(
                            tooltip: s.commonMore,
                            visualDensity: VisualDensity.compact,
                            iconSize: 16,
                            onPressed:
                                () => _showNotebookMenu(itemContext, notebook),
                            icon: Icon(
                              LucideIcons.ellipsis,
                              size: 16,
                              color: colors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        );
      }
    }
    return widgets;
  }
}

IconData _notebookIcon(NotebookFormat format) {
  return switch (format) {
    NotebookFormat.blocks => LucideIcons.boxes,
    NotebookFormat.markdown => LucideIcons.fileCode,
    NotebookFormat.writer => LucideIcons.penLine,
  };
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    required this.tooltip,
    required this.icon,
    this.onPressed,
  });

  final String tooltip;
  final Widget icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      visualDensity: VisualDensity.compact,
      style: IconButton.styleFrom(
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        padding: const EdgeInsets.all(6),
        minimumSize: const Size(34, 34),
        fixedSize: const Size(34, 34),
      ),
      icon: icon,
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
          color: colors.muted,
        ),
      ),
    );
  }
}
