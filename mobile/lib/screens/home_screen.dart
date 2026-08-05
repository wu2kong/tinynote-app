import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/path_utils.dart';
import '../core/types.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';
import '../widgets/library_drawer.dart';
import '../widgets/note_block_card.dart';
import '../widgets/note_block_sheet.dart';
import 'note_block_editor_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.library});

  final LibraryService library;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _searchController = TextEditingController();
  String _query = '';
  String? _selectedBlockId;

  LibraryService get library => widget.library;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _openEditor({
    required NoteBlock block,
    bool isNew = false,
  }) async {
    setState(() => _selectedBlockId = block.id);
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => NoteBlockEditorScreen(
          library: library,
          block: block,
          isNew: isNew,
        ),
      ),
    );
  }

  Future<void> _openNoteBlock(NoteBlock block) async {
    final notebook = library.currentNotebook;
    final space = library.currentSpace;
    if (notebook == null) return;

    setState(() => _selectedBlockId = block.id);
    await showNoteBlockSheet(
      context: context,
      library: library,
      block: block,
      breadcrumb: _breadcrumb(space, notebook),
      spaceName: space?.name ?? 'TinyNote 轻记',
      onDeleted: (deleted) async {
        if (_selectedBlockId == deleted.id) {
          setState(() => _selectedBlockId = null);
        }
      },
    );
  }

  Future<void> _createNoteBlock() async {
    try {
      final block = await library.addNoteBlock();
      if (!mounted) return;
      await _openEditor(block: block, isNew: true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('新建失败：$error')),
      );
    }
  }

  Future<void> _confirmAndDelete(NoteBlock block) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('删除笔记块'),
        content: Text('确定删除「${block.title}」吗？'),
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
      await library.deleteNoteBlock(block.id);
      if (_selectedBlockId == block.id) {
        setState(() => _selectedBlockId = null);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('已删除「${block.title}」')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('删除失败：$error')),
      );
    }
  }

  List<NoteBlock> _filteredBlocks(List<NoteBlock> blocks) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return blocks;
    return blocks.where((block) {
      return block.title.toLowerCase().contains(q) ||
          block.content.toLowerCase().contains(q) ||
          block.tags.any((tag) => tag.toLowerCase().contains(q));
    }).toList();
  }

  String _breadcrumb(Space? space, Notebook notebook) {
    if (space == null) return notebook.name;
    final spacePath = normalizePath(space.path);
    final parentPath = normalizePath(dirname(notebook.path));
    if (parentPath == spacePath || parentPath.isEmpty) {
      return notebook.name;
    }
    final relative = parentPath.startsWith('$spacePath/')
        ? parentPath.substring(spacePath.length + 1)
        : basename(parentPath);
    final folders = relative.split('/').where((part) => part.isNotEmpty);
    return [...folders, notebook.name].join(' / ');
  }

  @override
  Widget build(BuildContext context) {
    if (library.loading && !library.ready) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: AppColors.accent),
              SizedBox(height: 12),
              Text('正在初始化笔记库…', style: TextStyle(color: AppColors.body)),
            ],
          ),
        ),
      );
    }

    if (library.errorMessage != null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(LucideIcons.circleAlert, size: 44, color: AppColors.danger),
                const SizedBox(height: 16),
                Text(
                  library.errorMessage!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.body),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: AppColors.accent),
                  onPressed: library.resetAndRetry,
                  child: const Text('重试'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final notebook = library.currentNotebook;
    final space = library.currentSpace;
    final spaceName = space?.name ?? 'TinyNote 轻记';

    final showFab = notebook != null && !library.notebookLoading;
    final edgeWidth = MediaQuery.paddingOf(context).left + 72;

    final body = notebook == null
        ? _EmptyScaffold(spaceName: space?.name)
        : library.notebookLoading
            ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
            : _NotesScaffold(
                spaceName: spaceName,
                breadcrumb: _breadcrumb(space, notebook),
                searchController: _searchController,
                query: _query,
                onQueryChanged: (value) => setState(() => _query = value),
                onCreate: _createNoteBlock,
                onRefresh: () => library.selectNotebook(notebook),
                blocks: _filteredBlocks(notebook.noteBlocks),
                totalCount: notebook.noteBlocks.length,
                selectedBlockId: _selectedBlockId,
                onSelect: _openNoteBlock,
                onDelete: _confirmAndDelete,
              );

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: LibraryDrawer(library: library),
      // Default drawer needs ~50% width dragged; use a short custom edge swipe instead.
      drawerEnableOpenDragGesture: false,
      floatingActionButton: showFab
          ? FloatingActionButton(
              onPressed: _createNoteBlock,
              tooltip: '新建笔记块',
              backgroundColor: AppColors.accent,
              foregroundColor: Colors.white,
              elevation: 4,
              child: const Icon(LucideIcons.plus, size: 24),
            )
          : null,
      body: _ShortDrawerEdgeSwipe(
        edgeWidth: edgeWidth,
        child: body,
      ),
    );
  }
}

/// Opens the Scaffold drawer after a short rightward edge swipe.
///
/// Flutter's built-in drawer settle threshold is 50% of drawer width, which
/// feels too long; this triggers open around ~36px or a light fling.
class _ShortDrawerEdgeSwipe extends StatefulWidget {
  const _ShortDrawerEdgeSwipe({
    required this.child,
    required this.edgeWidth,
  });

  final Widget child;
  final double edgeWidth;

  @override
  State<_ShortDrawerEdgeSwipe> createState() => _ShortDrawerEdgeSwipeState();
}

class _ShortDrawerEdgeSwipeState extends State<_ShortDrawerEdgeSwipe> {
  static const _openDistance = 36.0;
  static const _flingVelocity = 180.0;

  double _dx = 0;
  var _opened = false;

  void _openDrawer() {
    if (_opened) return;
    final scaffold = Scaffold.maybeOf(context);
    if (scaffold == null || scaffold.isDrawerOpen) return;
    _opened = true;
    scaffold.openDrawer();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        Positioned(
          left: 0,
          top: 0,
          bottom: 0,
          width: widget.edgeWidth,
          child: GestureDetector(
            behavior: HitTestBehavior.translucent,
            dragStartBehavior: DragStartBehavior.down,
            onHorizontalDragStart: (_) {
              _dx = 0;
              _opened = false;
            },
            onHorizontalDragUpdate: (details) {
              final delta = details.primaryDelta ?? 0;
              if (delta <= 0 && _dx <= 0) return;
              _dx += delta;
              if (_dx >= _openDistance) {
                _openDrawer();
              }
            },
            onHorizontalDragEnd: (details) {
              if (_opened) return;
              final vx = details.velocity.pixelsPerSecond.dx;
              if (vx >= _flingVelocity || _dx >= _openDistance * 0.7) {
                _openDrawer();
              }
              _dx = 0;
            },
            onHorizontalDragCancel: () {
              _dx = 0;
              _opened = false;
            },
          ),
        ),
      ],
    );
  }
}

class _NotesScaffold extends StatelessWidget {
  const _NotesScaffold({
    required this.spaceName,
    required this.breadcrumb,
    required this.searchController,
    required this.query,
    required this.onQueryChanged,
    required this.onCreate,
    required this.onRefresh,
    required this.blocks,
    required this.totalCount,
    required this.selectedBlockId,
    required this.onSelect,
    required this.onDelete,
  });

  final String spaceName;
  final String breadcrumb;
  final TextEditingController searchController;
  final String query;
  final ValueChanged<String> onQueryChanged;
  final VoidCallback onCreate;
  final Future<void> Function() onRefresh;
  final List<NoteBlock> blocks;
  final int totalCount;
  final String? selectedBlockId;
  final ValueChanged<NoteBlock> onSelect;
  final ValueChanged<NoteBlock> onDelete;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 16, 8),
            child: Row(
              children: [
                IconButton(
                  tooltip: '打开目录',
                  onPressed: () => Scaffold.of(context).openDrawer(),
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.surface,
                    side: const BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(LucideIcons.panelLeft, size: 20, color: AppColors.title),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        spaceName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.title,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        breadcrumb,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Material(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    onTap: onCreate,
                    borderRadius: BorderRadius.circular(12),
                    child: const SizedBox(
                      width: 42,
                      height: 42,
                      child: Icon(LucideIcons.plus, size: 22, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: TextField(
              controller: searchController,
              onChanged: onQueryChanged,
              decoration: InputDecoration(
                hintText: '搜索当前目录笔记',
                hintStyle: const TextStyle(color: AppColors.muted, fontSize: 14),
                prefixIcon: const Icon(LucideIcons.search, color: AppColors.muted, size: 18),
                suffixIcon: query.isEmpty
                    ? null
                    : IconButton(
                        onPressed: () {
                          searchController.clear();
                          onQueryChanged('');
                        },
                        icon: const Icon(LucideIcons.x, size: 16, color: AppColors.muted),
                      ),
                filled: true,
                fillColor: AppColors.surface,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(999),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(999),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(999),
                  borderSide: const BorderSide(color: AppColors.accent, width: 1.4),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: Row(
              children: [
                Text(
                  '${blocks.length == totalCount ? totalCount : blocks.length} 条笔记',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.title,
                  ),
                ),
                if (blocks.length != totalCount)
                  Text(
                    ' / 共 $totalCount',
                    style: const TextStyle(fontSize: 12, color: AppColors.muted),
                  ),
                const Spacer(),
                const Text(
                  '左滑可删除',
                  style: TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.accent,
              onRefresh: onRefresh,
              child: blocks.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        const SizedBox(height: 100),
                        Center(
                          child: Text(
                            query.isEmpty ? '此笔记本暂无笔记块' : '没有匹配的笔记',
                            style: const TextStyle(color: AppColors.body),
                          ),
                        ),
                        if (query.isEmpty) ...[
                          const SizedBox(height: 16),
                          Center(
                            child: FilledButton.icon(
                              style: FilledButton.styleFrom(
                                backgroundColor: AppColors.accent,
                              ),
                              onPressed: onCreate,
                              icon: const Icon(LucideIcons.plus, size: 18),
                              label: const Text('新建笔记块'),
                            ),
                          ),
                        ],
                      ],
                    )
                  : SlidableAutoCloseBehavior(
                      child: ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                        itemCount: blocks.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final block = blocks[index];
                          final selected = selectedBlockId == block.id ||
                              (selectedBlockId == null && index == 0);
                          return _SwipeDeleteTile(
                            key: ValueKey(block.id),
                            onDelete: () => onDelete(block),
                            child: NoteBlockCard(
                              block: block,
                              selected: selected,
                              onTap: () => onSelect(block),
                            ),
                          );
                        },
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SwipeDeleteTile extends StatelessWidget {
  const _SwipeDeleteTile({
    super.key,
    required this.child,
    required this.onDelete,
  });

  final Widget child;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Slidable(
      key: key,
      groupTag: 'note-blocks',
      endActionPane: ActionPane(
        motion: const BehindMotion(),
        extentRatio: 0.22,
        children: [
          CustomSlidableAction(
            onPressed: (_) => onDelete(),
            backgroundColor: Colors.transparent,
            foregroundColor: Colors.white,
            padding: EdgeInsets.zero,
            child: Container(
              width: double.infinity,
              margin: const EdgeInsets.only(left: 10),
              decoration: BoxDecoration(
                color: AppColors.danger,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.trash2, size: 20, color: Colors.white),
                  SizedBox(height: 4),
                  Text(
                    '删除',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _EmptyScaffold extends StatelessWidget {
  const _EmptyScaffold({required this.spaceName});

  final String? spaceName;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 16, 8),
            child: Row(
              children: [
                IconButton(
                  tooltip: '打开目录',
                  onPressed: () => Scaffold.of(context).openDrawer(),
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.surface,
                    side: const BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(LucideIcons.panelLeft, size: 20, color: AppColors.title),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    spaceName ?? 'TinyNote 轻记',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.title,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(LucideIcons.panelLeftOpen, size: 44, color: AppColors.muted),
                    const SizedBox(height: 16),
                    const Text(
                      '零碎笔记整理',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.accent,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      spaceName == null ? '从左侧打开空间与目录' : '在「$spaceName」中选择笔记本',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        color: AppColors.title,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '从屏幕左缘向右滑动打开目录，选择笔记本后即可浏览与编辑笔记块。',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, height: 1.4, color: AppColors.body),
                    ),
                    const SizedBox(height: 20),
                    OutlinedButton.icon(
                      onPressed: () => Scaffold.of(context).openDrawer(),
                      icon: const Icon(LucideIcons.menu, size: 18),
                      label: const Text('打开目录'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
