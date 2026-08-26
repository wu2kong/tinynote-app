import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/layout_breakpoints.dart';
import '../core/note_parser.dart';
import '../core/path_utils.dart';
import '../core/types.dart';
import '../l10n/l10n.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';
import '../widgets/document_notebook_view.dart';
import '../widgets/library_drawer.dart';
import '../widgets/note_block_card.dart';
import '../widgets/note_block_detail_pane.dart';
import '../widgets/note_block_sheet.dart';
import '../widgets/unsupported_notebook_view.dart';
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
  String? _selectedNotebookPath;

  LibraryService get library => widget.library;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _syncSelectionForNotebook(Notebook? notebook) {
    final path = notebook?.path;
    final pathChanged = path != _selectedNotebookPath;
    final missingSelection =
        notebook != null &&
        _selectedBlockId != null &&
        !notebook.noteBlocks.any((b) => b.id == _selectedBlockId);

    if (!pathChanged && !missingSelection) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() {
        if (path != _selectedNotebookPath) {
          _selectedNotebookPath = path;
          _selectedBlockId = null;
          _query = '';
          _searchController.clear();
          return;
        }
        if (notebook == null || _selectedBlockId == null) return;
        final exists = notebook.noteBlocks.any((b) => b.id == _selectedBlockId);
        if (!exists) {
          _selectedBlockId = null;
        }
      });
    });
  }

  NoteBlock? _selectedBlock(Notebook? notebook) {
    final id = _selectedBlockId;
    if (notebook == null || id == null) return null;
    for (final block in notebook.noteBlocks) {
      if (block.id == id) return block;
    }
    return null;
  }

  Future<void> _openEditor({
    required NoteBlock block,
    bool isNew = false,
  }) async {
    setState(() => _selectedBlockId = block.id);
    final saved = await showNoteBlockEditorSheet(
      context: context,
      library: library,
      block: block,
      isNew: isNew,
    );
    if (!mounted) return;
    // Discarded new draft was never persisted — clear stale selection.
    if (isNew && saved != true && _selectedBlockId == block.id) {
      setState(() => _selectedBlockId = null);
    }
  }

  Future<void> _openNoteBlock(NoteBlock block, {required bool splitDetail}) async {
    final notebook = library.currentNotebook;
    final space = library.currentSpace;
    if (notebook == null) return;

    setState(() => _selectedBlockId = block.id);

    if (splitDetail) {
      return;
    }

    await showNoteBlockSheet(
      context: context,
      library: library,
      block: block,
      breadcrumb: _breadcrumb(space, notebook),
      spaceName: space?.name ?? context.s.appTitle,
      onDeleted: (deleted) async {
        if (_selectedBlockId == deleted.id) {
          setState(() => _selectedBlockId = null);
        }
      },
    );
  }

  Future<void> _createNoteBlock() async {
    try {
      if (library.currentNotebook == null) {
        throw StateError(context.s.noNotebookSelected);
      }
      final block = createNoteBlock();
      if (!mounted) return;
      await _openEditor(block: block, isNew: true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            context.s.fill(context.s.createFailed, {'error': '$error'}),
          ),
        ),
      );
    }
  }

  Future<void> _confirmAndDelete(NoteBlock block) async {
    final s = context.s;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        final colors = context.colors;
        return AlertDialog(
          title: Text(s.deleteNoteBlock),
          content: Text(
            s.fill(s.deleteNoteBlockMessage, {'name': block.title}),
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
      await library.deleteNoteBlock(block.id);
      if (_selectedBlockId == block.id) {
        setState(() => _selectedBlockId = null);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(s.fill(s.deletedNoteBlock, {'name': block.title})),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.fill(s.deleteFailed, {'error': '$error'}))),
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
    final relative =
        parentPath.startsWith('$spacePath/')
            ? parentPath.substring(spacePath.length + 1)
            : basename(parentPath);
    final folders = relative.split('/').where((part) => part.isNotEmpty);
    return [...folders, notebook.name].join(' / ');
  }

  Widget _buildMainContent({
    required bool wide,
    required bool splitDetail,
  }) {
    final colors = context.colors;
    final s = context.s;
    final notebook = library.currentNotebook;
    final space = library.currentSpace;
    final spaceName = space?.name ?? s.appTitle;
    final showDirectoryButton = !wide;

    final showUnsupportedGate =
        notebook != null &&
        notebook.format.isUnsupported &&
        !notebook.compatOpenAsMarkdown;
    final showDocumentView =
        notebook != null &&
        (notebook.format.isDocument || notebook.compatOpenAsMarkdown);
    final showBlocksView =
        notebook != null &&
        !library.notebookLoading &&
        notebook.format == NotebookFormat.blocks;

    if (notebook == null) {
      return _EmptyScaffold(
        spaceName: space?.name,
        showDirectoryButton: showDirectoryButton,
        wideLayout: wide,
      );
    }
    if (library.notebookLoading) {
      return Center(child: CircularProgressIndicator(color: colors.accent));
    }
    if (showUnsupportedGate) {
      return UnsupportedNotebookView(library: library, notebook: notebook);
    }
    if (showDocumentView) {
      return DocumentNotebookView(
        library: library,
        notebook: notebook,
        spaceName: spaceName,
        breadcrumb: _breadcrumb(space, notebook),
        showDirectoryButton: showDirectoryButton,
      );
    }
    if (!showBlocksView) {
      return UnsupportedNotebookView(library: library, notebook: notebook);
    }

    final filtered = _filteredBlocks(notebook.noteBlocks);
    final selected = _selectedBlock(notebook);
    final list = _NotesScaffold(
      spaceName: spaceName,
      breadcrumb: _breadcrumb(space, notebook),
      searchController: _searchController,
      query: _query,
      onQueryChanged: (value) => setState(() => _query = value),
      onCreate: _createNoteBlock,
      onRefresh: () => library.selectNotebook(notebook),
      blocks: filtered,
      totalCount: notebook.noteBlocks.length,
      selectedBlockId: _selectedBlockId,
      highlightFirstWhenNone: !splitDetail,
      showDirectoryButton: showDirectoryButton,
      showSwipeHint: !splitDetail,
      onSelect: (block) => _openNoteBlock(block, splitDetail: splitDetail),
      onDelete: _confirmAndDelete,
    );

    if (!splitDetail) {
      return list;
    }

    return Row(
      children: [
        SizedBox(
          width: kNotesListPaneWidth,
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border(right: BorderSide(color: colors.border)),
            ),
            child: list,
          ),
        ),
        Expanded(
          child:
              selected == null
                  ? const NoteBlockDetailEmpty()
                  : NoteBlockDetailPane(
                    key: ValueKey(selected.id),
                    library: library,
                    block: selected,
                    breadcrumb: _breadcrumb(space, notebook),
                    spaceName: spaceName,
                    onDeleted: (deleted) async {
                      if (_selectedBlockId == deleted.id) {
                        setState(() => _selectedBlockId = null);
                      }
                    },
                    onChanged: (updated) {
                      setState(() => _selectedBlockId = updated.id);
                    },
                  ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;
    final wide = isWideLayout(context);
    final splitDetail = isSplitDetailLayout(context);

    _syncSelectionForNotebook(library.currentNotebook);

    if (library.loading && !library.ready) {
      return Scaffold(
        backgroundColor: colors.background,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: colors.accent),
              const SizedBox(height: 12),
              Text(s.initializingLibrary, style: TextStyle(color: colors.body)),
            ],
          ),
        ),
      );
    }

    if (library.errorMessage != null) {
      return Scaffold(
        backgroundColor: colors.background,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(LucideIcons.circleAlert, size: 44, color: colors.danger),
                const SizedBox(height: 16),
                Text(
                  library.errorMessage!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: colors.body),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: colors.accent),
                  onPressed: library.resetAndRetry,
                  child: Text(s.commonRetry),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final notebook = library.currentNotebook;
    final showFab =
        notebook != null &&
        !library.notebookLoading &&
        notebook.format == NotebookFormat.blocks &&
        !splitDetail;

    final libraryPanel = LibraryDrawer(
      library: library,
      onOpenNoteBlock: (block) => _openNoteBlock(block, splitDetail: splitDetail),
      asSidebar: wide,
      width: kSidebarWidth,
    );

    final body = _buildMainContent(wide: wide, splitDetail: splitDetail);

    if (wide) {
      return Scaffold(
        backgroundColor: colors.background,
        floatingActionButton:
            showFab
                ? FloatingActionButton(
                  onPressed: _createNoteBlock,
                  tooltip: s.newNoteBlock,
                  backgroundColor: colors.accent,
                  foregroundColor: Colors.white,
                  elevation: 4,
                  child: const Icon(LucideIcons.plus, size: 24),
                )
                : null,
        body: Row(
          children: [
            libraryPanel,
            VerticalDivider(width: 1, thickness: 1, color: colors.border),
            Expanded(child: body),
          ],
        ),
      );
    }

    final edgeWidth = MediaQuery.paddingOf(context).left + 72;

    return Scaffold(
      backgroundColor: colors.background,
      drawer: libraryPanel,
      // Default drawer needs ~50% width dragged; use a short custom edge swipe instead.
      drawerEnableOpenDragGesture: false,
      floatingActionButton:
          showFab
              ? FloatingActionButton(
                onPressed: _createNoteBlock,
                tooltip: s.newNoteBlock,
                backgroundColor: colors.accent,
                foregroundColor: Colors.white,
                elevation: 4,
                child: const Icon(LucideIcons.plus, size: 24),
              )
              : null,
      body: _ShortDrawerEdgeSwipe(edgeWidth: edgeWidth, child: body),
    );
  }
}

/// Opens the Scaffold drawer after a short rightward edge swipe.
///
/// Flutter's built-in drawer settle threshold is 50% of drawer width, which
/// feels too long; this triggers open around ~36px or a light fling.
class _ShortDrawerEdgeSwipe extends StatefulWidget {
  const _ShortDrawerEdgeSwipe({required this.child, required this.edgeWidth});

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
    this.showDirectoryButton = true,
    this.highlightFirstWhenNone = true,
    this.showSwipeHint = true,
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
  final bool showDirectoryButton;
  final bool highlightFirstWhenNone;
  final bool showSwipeHint;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 16, 8),
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
                const SizedBox(width: 10),
                Material(
                  color: colors.accent,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    onTap: onCreate,
                    borderRadius: BorderRadius.circular(12),
                    child: const SizedBox(
                      width: 42,
                      height: 42,
                      child: Icon(
                        LucideIcons.plus,
                        size: 22,
                        color: Colors.white,
                      ),
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
                hintText: s.searchCurrentNotebook,
                hintStyle: TextStyle(color: colors.muted, fontSize: 14),
                prefixIcon: Icon(
                  LucideIcons.search,
                  color: colors.muted,
                  size: 18,
                ),
                suffixIcon:
                    query.isEmpty
                        ? null
                        : IconButton(
                          onPressed: () {
                            searchController.clear();
                            onQueryChanged('');
                          },
                          icon: Icon(
                            LucideIcons.x,
                            size: 16,
                            color: colors.muted,
                          ),
                        ),
                filled: true,
                fillColor: colors.surface,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 12,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(999),
                  borderSide: BorderSide(color: colors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(999),
                  borderSide: BorderSide(color: colors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(999),
                  borderSide: BorderSide(color: colors.accent, width: 1.4),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: Row(
              children: [
                Text(
                  s.fill(s.notesCount, {
                    'count':
                        '${blocks.length == totalCount ? totalCount : blocks.length}',
                  }),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: colors.title,
                  ),
                ),
                if (blocks.length != totalCount)
                  Text(
                    s.fill(s.totalCountSuffix, {'count': '$totalCount'}),
                    style: TextStyle(fontSize: 12, color: colors.muted),
                  ),
                const Spacer(),
                if (showSwipeHint)
                  Text(
                    s.swipeLeftToDelete,
                    style: TextStyle(fontSize: 12, color: colors.muted),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: colors.accent,
              onRefresh: onRefresh,
              child:
                  blocks.isEmpty
                      ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          const SizedBox(height: 100),
                          Center(
                            child: Text(
                              query.isEmpty
                                  ? s.emptyNotebook
                                  : s.noMatchingNotes,
                              style: TextStyle(color: colors.body),
                            ),
                          ),
                          if (query.isEmpty) ...[
                            const SizedBox(height: 16),
                            Center(
                              child: FilledButton.icon(
                                style: FilledButton.styleFrom(
                                  backgroundColor: colors.accent,
                                ),
                                onPressed: onCreate,
                                icon: const Icon(LucideIcons.plus, size: 18),
                                label: Text(s.newNoteBlock),
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
                          separatorBuilder:
                              (_, _) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final block = blocks[index];
                            final selected =
                                selectedBlockId == block.id ||
                                (highlightFirstWhenNone &&
                                    selectedBlockId == null &&
                                    index == 0);
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
    final colors = context.colors;
    final s = context.s;

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
                color: colors.danger,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(LucideIcons.trash2, size: 20, color: Colors.white),
                  const SizedBox(height: 4),
                  Text(
                    s.commonDelete,
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
        ],
      ),
      child: child,
    );
  }
}

class _EmptyScaffold extends StatelessWidget {
  const _EmptyScaffold({
    required this.spaceName,
    this.showDirectoryButton = true,
    this.wideLayout = false,
  });

  final String? spaceName;
  final bool showDirectoryButton;
  final bool wideLayout;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;

    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 16, 8),
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
                  child: Text(
                    spaceName ?? s.appTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: colors.title,
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
                    Icon(
                      LucideIcons.panelLeftOpen,
                      size: 44,
                      color: colors.muted,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      s.appTagline,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: colors.accent,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      spaceName == null
                          ? s.openSpaceAndFolders
                          : s.fill(s.chooseNotebookInSpace, {
                            'name': spaceName!,
                          }),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        color: colors.title,
                      ),
                    ),
                    if (!wideLayout || spaceName != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        wideLayout
                            ? s.openSpaceAndFolders
                            : s.openDirectoryInstructions,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          height: 1.4,
                          color: colors.body,
                        ),
                      ),
                    ],
                    if (showDirectoryButton) ...[
                      const SizedBox(height: 20),
                      OutlinedButton.icon(
                        onPressed: () => Scaffold.of(context).openDrawer(),
                        icon: const Icon(LucideIcons.menu, size: 18),
                        label: Text(s.openDirectory),
                      ),
                    ],
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
