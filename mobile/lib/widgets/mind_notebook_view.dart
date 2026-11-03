import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/types.dart';
import '../l10n/l10n.dart';
import '../services/library_service.dart';

class MindNotebookView extends StatefulWidget {
  const MindNotebookView({
    super.key,
    required this.library,
    required this.notebook,
    this.showDirectoryButton = true,
  });
  final LibraryService library;
  final Notebook notebook;
  final bool showDirectoryButton;
  @override
  State<MindNotebookView> createState() => _MindNotebookViewState();
}

class _MindNotebookViewState extends State<MindNotebookView> {
  Map<String, dynamic> _doc = {
    'version': 1,
    'mode': 'outline',
    'nodes': <dynamic>[],
  };
  String _synced = '';
  bool _saving = false;
  String tr(String key) => context.s.ch('mind.$key');
  List<Map<String, dynamic>> get nodes => _asNodes(_doc['nodes']);
  String _markdown() {
    final lines = <String>['# ${widget.notebook.name.trim()}'];
    String label(dynamic value) =>
        (value ?? '').toString().trim().replaceAll(RegExp(r'\s*\n\s*'), ' ');
    void addChildren(List<Map<String, dynamic>> children, int depth) {
      for (final node in children) {
        lines.add("${List.filled(depth, '  ').join()}- ${label(node['text'])}");
        addChildren(_asNodes(node['children']), depth + 1);
      }
    }

    for (final node in nodes) {
      lines.add('');
      lines.add('## ${label(node['text'])}');
      addChildren(_asNodes(node['children']), 0);
    }
    return '${lines.join('\n')}\n';
  }

  Future<void> _copyMarkdown() async {
    try {
      await Clipboard.setData(ClipboardData(text: _markdown()));
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(tr('copiedMarkdown'))));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(tr('copyFailed'))));
      }
    }
  }

  List<Map<String, dynamic>> _asNodes(dynamic value) =>
      (value is List ? value : const [])
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
  String _newId() =>
      '${DateTime.now().microsecondsSinceEpoch}-${DateTime.now().hashCode}';
  List<Map<String, dynamic>> _normalizeNodes(
    dynamic value,
    Set<String> seen, [
    int depth = 0,
  ]) {
    if (value is! List || depth > 40) return [];
    final result = <Map<String, dynamic>>[];
    for (final item in value) {
      if (item is! Map) continue;
      final raw = Map<String, dynamic>.from(item);
      var id =
          raw['id'] is String && (raw['id'] as String).isNotEmpty
              ? raw['id'] as String
              : _newId();
      if (seen.contains(id)) id = _newId();
      seen.add(id);
      result.add({
        'id': id,
        'text': raw['text'] is String ? raw['text'] : '',
        'collapsed': raw['collapsed'] == true,
        'children': _normalizeNodes(raw['children'], seen, depth + 1),
      });
    }
    return result;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant MindNotebookView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_saving && widget.notebook.documentContent != _synced) _load();
  }

  void _load() {
    _synced = widget.notebook.documentContent;
    try {
      final value = jsonDecode(_synced);
      if (value is Map<String, dynamic>) {
        _doc = value;
        _doc['nodes'] = _normalizeNodes(_doc['nodes'], <String>{});
        if (_doc['mode'] != 'mindmap') _doc['mode'] = 'outline';
      } else {
        _doc = {'version': 1, 'mode': 'outline', 'nodes': <dynamic>[]};
      }
    } catch (_) {
      _doc = {'version': 1, 'mode': 'outline', 'nodes': <dynamic>[]};
    }
  }

  Future<void> _save(void Function() change) async {
    if (_saving) return;
    final before = jsonEncode(_doc);
    setState(() {
      change();
      _saving = true;
    });
    final content = '${const JsonEncoder.withIndent('  ').convert(_doc)}\n';
    try {
      await widget.library.updateNotebookContent(content);
      _synced = content;
    } catch (error) {
      _doc = Map<String, dynamic>.from(jsonDecode(before));
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  List<Map<String, dynamic>> _changeNode(
    List<Map<String, dynamic>> source,
    String id,
    Map<String, dynamic> Function(Map<String, dynamic>) change,
  ) => [
    for (final node in source)
      node['id'] == id
          ? change(node)
          : {
            ...node,
            'children': _changeNode(_asNodes(node['children']), id, change),
          },
  ];
  List<Map<String, dynamic>> _insert(
    List<Map<String, dynamic>> source,
    String? targetId,
    String placement,
    Map<String, dynamic> item,
  ) {
    if (targetId == null) return [...source, item];
    return [
      for (final node in source)
        if (node['id'] == targetId) ...[
          if (placement == 'after') node,
          if (placement == 'after') item,
          if (placement == 'child')
            {
              ...node,
              'collapsed': false,
              'children': [..._asNodes(node['children']), item],
            },
        ] else
          {
            ...node,
            'children': _insert(
              _asNodes(node['children']),
              targetId,
              placement,
              item,
            ),
          },
    ];
  }

  List<Map<String, dynamic>> _delete(
    List<Map<String, dynamic>> source,
    String id,
  ) => [
    for (final node in source)
      if (node['id'] != id)
        {...node, 'children': _delete(_asNodes(node['children']), id)},
  ];
  List<Map<String, dynamic>> _move(
    List<Map<String, dynamic>> source,
    String id,
    int direction,
  ) {
    final index = source.indexWhere((node) => node['id'] == id);
    if (index >= 0) {
      final next = [...source];
      final target = index + direction;
      if (target >= 0 && target < next.length) {
        final moving = next.removeAt(index);
        next.insert(target, moving);
      }
      return next;
    }
    return [
      for (final node in source)
        {...node, 'children': _move(_asNodes(node['children']), id, direction)},
    ];
  }

  Map<String, dynamic>? _findNode(
    List<Map<String, dynamic>> source,
    String id,
  ) {
    for (final node in source) {
      if (node['id'] == id) return node;
      final child = _findNode(_asNodes(node['children']), id);
      if (child != null) return child;
    }
    return null;
  }

  bool _branchExpanded(Map<String, dynamic> node) =>
      node['collapsed'] != true &&
      _asNodes(node['children']).every(_branchExpanded);

  Map<String, dynamic> _setBranchCollapsed(
    Map<String, dynamic> node,
    bool collapsed,
  ) => {
    ...node,
    'collapsed': collapsed,
    'children': [
      for (final child in _asNodes(node['children']))
        _setBranchCollapsed(child, collapsed),
    ],
  };

  Future<void> _moveToParent(String id) async {
    final moving = _findNode(nodes, id);
    if (moving == null) return;
    final options = <(String, String, int)>[];
    void collect(List<Map<String, dynamic>> source, int depth) {
      for (final node in source) {
        if (node['id'] == id) continue;
        options.add((
          node['id'].toString(),
          (node['text'] ?? '').toString(),
          depth,
        ));
        collect(_asNodes(node['children']), depth + 1);
      }
    }

    collect(nodes, 0);
    final destination = await showDialog<String>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: Text(tr('moveTo')),
            content: SizedBox(
              width: 360,
              height: 320,
              child: ListView(
                children: [
                  ListTile(
                    title: Text(tr('rootLevel')),
                    onTap: () => Navigator.pop(ctx, '__root__'),
                  ),
                  for (final option in options)
                    ListTile(
                      contentPadding: EdgeInsets.only(
                        left: 16 + option.$3 * 14.0,
                      ),
                      title: Text(
                        option.$2.isEmpty ? tr('nodePlaceholder') : option.$2,
                      ),
                      onTap: () => Navigator.pop(ctx, option.$1),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text(context.s.commonCancel),
              ),
            ],
          ),
    );
    if (destination == null || !mounted) return;
    final parentId = destination == '__root__' ? null : destination;
    if (parentId == id ||
        (parentId != null &&
            (_findNode(nodes, parentId) == null ||
                _findNode(_asNodes(moving['children']), parentId) != null))) {
      return;
    }
    await _save(() {
      final without = _delete(nodes, id);
      _doc['nodes'] =
          parentId == null
              ? [...without, moving]
              : _insert(without, parentId, 'child', moving);
    });
  }

  Future<String?> _prompt(String title, [String value = '']) async {
    final controller = TextEditingController(text: value);
    final result = await showDialog<String>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: Text(title),
            content: TextField(
              controller: controller,
              autofocus: true,
              minLines: 1,
              maxLines: 6,
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text(context.s.commonCancel),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, controller.text),
                child: Text(context.s.commonSave),
              ),
            ],
          ),
    );
    Future.delayed(const Duration(milliseconds: 300), controller.dispose);
    return result;
  }

  Future<void> _add(String? targetId, String placement) async {
    final text = await _prompt(
      tr(
        targetId == null
            ? 'addRoot'
            : placement == 'child'
            ? 'addChild'
            : 'addSibling',
      ),
    );
    if (text == null || !mounted) return;
    await _save(
      () =>
          _doc['nodes'] = _insert(nodes, targetId, placement, {
            'id': _newId(),
            'text': text.trim(),
            'children': <dynamic>[],
          }),
    );
  }

  Future<void> _action(Map<String, dynamic> node, String action) async {
    final id = node['id'].toString();
    if (action == 'edit') {
      final text = await _prompt(
        tr('addTopic'),
        (node['text'] ?? '').toString(),
      );
      if (text != null && mounted) {
        await _save(
          () =>
              _doc['nodes'] = _changeNode(
                nodes,
                id,
                (value) => {...value, 'text': text.trim()},
              ),
        );
      }
    } else if (action == 'child' || action == 'after') {
      await _add(id, action);
    } else if (action == 'up' || action == 'down') {
      await _save(
        () => _doc['nodes'] = _move(nodes, id, action == 'up' ? -1 : 1),
      );
    } else if (action == 'move') {
      await _moveToParent(id);
    } else if (action == 'delete') {
      await _save(() => _doc['nodes'] = _delete(nodes, id));
    }
  }

  Widget _nodeCard(Map<String, dynamic> node, int depth) {
    final children = _asNodes(node['children']);
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: Icon(
              node['collapsed'] == true
                  ? Icons.chevron_right
                  : Icons.expand_more,
              size: 18,
            ),
            onPressed:
                children.isEmpty
                    ? null
                    : () => _save(
                      () =>
                          _doc['nodes'] = _changeNode(
                            nodes,
                            node['id'].toString(),
                            (value) => {
                              ...value,
                              'collapsed': value['collapsed'] != true,
                            },
                          ),
                    ),
          ),
          if (children.isNotEmpty)
            IconButton(
              key: ValueKey('mind-toggle-all:${node['id']}'),
              tooltip: tr(_branchExpanded(node) ? 'collapseAll' : 'expandAll'),
              icon: Icon(
                _branchExpanded(node) ? Icons.unfold_less : Icons.unfold_more,
                size: 18,
              ),
              onPressed:
                  () => _save(
                    () =>
                        _doc['nodes'] = _changeNode(
                          nodes,
                          node['id'].toString(),
                          (value) =>
                              _setBranchCollapsed(value, _branchExpanded(node)),
                        ),
                  ),
            ),
          Flexible(
            child: InkWell(
              onTap: () => _action(node, 'edit'),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  vertical: 12,
                  horizontal: 3,
                ),
                child: Text(
                  (node['text'] ?? '').toString().isEmpty
                      ? tr(depth == 0 ? 'rootPlaceholder' : 'nodePlaceholder')
                      : node['text'].toString(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ),
          PopupMenuButton<String>(
            key: ValueKey('mind-actions:${node['id']}'),
            tooltip: tr('addTopic'),
            onSelected: (action) => _action(node, action),
            itemBuilder:
                (_) => [
                  PopupMenuItem(value: 'edit', child: Text(tr('addTopic'))),
                  PopupMenuItem(value: 'child', child: Text(tr('addChild'))),
                  PopupMenuItem(value: 'after', child: Text(tr('addSibling'))),
                  PopupMenuItem(value: 'up', child: Text(tr('moveUp'))),
                  PopupMenuItem(value: 'down', child: Text(tr('moveDown'))),
                  PopupMenuItem(value: 'move', child: Text(tr('moveTo'))),
                  PopupMenuItem(value: 'delete', child: Text(tr('delete'))),
                ],
          ),
        ],
      ),
    );
  }

  Widget _outlineNode(Map<String, dynamic> node, int depth) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Padding(
        padding: EdgeInsets.only(left: depth * 22.0),
        child: _nodeCard(node, depth),
      ),
      if (node['collapsed'] != true)
        for (final child in _asNodes(node['children']))
          _outlineNode(child, depth + 1),
    ],
  );
  Widget _mapNode(Map<String, dynamic> node, int depth) {
    final children =
        node['collapsed'] == true
            ? <Map<String, dynamic>>[]
            : _asNodes(node['children']);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(width: 230, child: _nodeCard(node, depth)),
        if (children.isNotEmpty) ...[
          Container(
            width: 24,
            height: 1,
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
          Container(
            padding: const EdgeInsets.only(left: 12),
            decoration: BoxDecoration(
              border: Border(
                left: BorderSide(
                  color: Theme.of(context).colorScheme.outlineVariant,
                ),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final child in children)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: _mapNode(child, depth + 1),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final map = _doc['mode'] == 'mindmap';
    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          ListTile(
            leading:
                widget.showDirectoryButton
                    ? IconButton(
                      icon: const Icon(Icons.menu),
                      tooltip: context.s.openDirectory,
                      onPressed: () => Scaffold.of(context).openDrawer(),
                    )
                    : null,
            title: Text(widget.notebook.name),
            trailing: IconButton(
              tooltip: tr('copyMarkdown'),
              icon: const Icon(Icons.copy_all),
              onPressed: _copyMarkdown,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                ChoiceChip(
                  label: Text(tr('outline')),
                  selected: !map,
                  onSelected: (_) => _save(() => _doc['mode'] = 'outline'),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: Text(tr('mindmap')),
                  selected: map,
                  onSelected: (_) => _save(() => _doc['mode'] = 'mindmap'),
                ),
                const Spacer(),
                IconButton(
                  tooltip: tr('addRoot'),
                  onPressed: () => _add(null, 'after'),
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
          ),
          Expanded(
            child:
                nodes.isEmpty
                    ? Center(child: Text(tr('empty')))
                    : map
                    ? SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: SingleChildScrollView(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              for (final node in nodes)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 20),
                                  child: _mapNode(node, 0),
                                ),
                            ],
                          ),
                        ),
                      ),
                    )
                    : ListView(
                      padding: const EdgeInsets.all(12),
                      children: [
                        for (final node in nodes) _outlineNode(node, 0),
                      ],
                    ),
          ),
        ],
      ),
    );
  }
}
