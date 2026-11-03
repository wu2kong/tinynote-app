import 'package:flutter/gestures.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/types.dart';
import '../l10n/l10n.dart';
import '../services/library_service.dart';
import '../utils/open_url.dart';

/// The desktop JSON document is kept intact, including unknown fields.
class ChannelNotebookView extends StatefulWidget {
  const ChannelNotebookView({
    super.key,
    required this.library,
    required this.notebook,
    this.showDirectoryButton = true,
  });
  final LibraryService library;
  final Notebook notebook;
  final bool showDirectoryButton;
  @override
  State<ChannelNotebookView> createState() => _ChannelNotebookViewState();
}

class _ChannelNotebookViewState extends State<ChannelNotebookView> {
  final _draft = TextEditingController();
  final _todoDraft = TextEditingController();
  final _search = TextEditingController();
  final _focus = FocusNode();
  Map<String, dynamic>? _doc;
  String _synced = '';
  String _tab = 'chat';
  String _author = 'self';
  bool _saving = false;
  bool _ungroupedCollapsed = false;
  static const _tabs = [
    'chat',
    'todos',
    'links',
    'resources',
    'members',
    'settings',
  ];
  String tr(String key) => context.s.ch(key);
  String todoTr(String key) => tr('todo.$key');
  List<Map<String, dynamic>> items(String key) =>
      (_doc?[key] as List? ?? [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
  String get selfId =>
      items('members').firstWhere(
            (m) => m['isSelf'] == true,
            orElse:
                () =>
                    items('members').isEmpty
                        ? {'id': 'self'}
                        : items('members').first,
          )['id']
          as String;
  String name(dynamic id) =>
      items('members')
          .firstWhere(
            (m) => m['id'] == id,
            orElse: () => {'name': tr('unknownMember')},
          )['name']
          .toString();
  String newId() => '${DateTime.now().microsecondsSinceEpoch}';

  @override
  void initState() {
    super.initState();
    _load();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focus.requestFocus();
    });
  }

  void _load() {
    _synced = widget.notebook.documentContent;
    try {
      final raw = jsonDecode(_synced);
      if (raw is! Map<String, dynamic>) return;
      _doc = raw;
      for (final key in [
        'members',
        'messages',
        'todos',
        'todoGroups',
        'links',
        'resources',
      ]) {
        if (raw[key] is! List) raw[key] = <dynamic>[];
      }
      if (items('members').isEmpty) {
        raw['members'] = [
          {
            'id': 'self',
            'name': appStrings.ch('selfMemberName'),
            'isSelf': true,
          },
        ];
      }
      _author = selfId;
    } catch (_) {
      _doc = null;
    }
  }

  @override
  void didUpdateWidget(covariant ChannelNotebookView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_saving && widget.notebook.documentContent != _synced) _load();
  }

  @override
  void dispose() {
    _draft.dispose();
    _todoDraft.dispose();
    _search.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> save(void Function() change) async {
    if (_saving || _doc == null) return;
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

  Future<String?> prompt(String title, [String value = '']) async {
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
              maxLines: 8,
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
    // Dialog routes finish their exit animation after the future resolves.
    Future.delayed(const Duration(milliseconds: 300), controller.dispose);
    return result;
  }

  Future<void> messageMenu(Map<String, dynamic> message) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      builder:
          (ctx) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.edit_outlined),
                  title: Text(context.s.commonEdit),
                  onTap: () => Navigator.pop(ctx, 'edit'),
                ),
                ListTile(
                  leading: const Icon(Icons.delete_outline),
                  title: Text(tr('deleteMessage')),
                  onTap: () => Navigator.pop(ctx, 'delete'),
                ),
              ],
            ),
          ),
    );
    if (!mounted) return;
    if (action == 'delete') {
      await save(
        () =>
            _doc!['messages'] =
                items(
                  'messages',
                ).where((m) => m['id'] != message['id']).toList(),
      );
    }
    if (!mounted) return;
    if (action == 'edit') {
      final value = await prompt(
        context.s.commonEdit,
        message['content']?.toString() ?? '',
      );
      if (value != null && mounted) {
        await save(
          () =>
              _doc!['messages'] =
                  items('messages')
                      .map(
                        (m) =>
                            m['id'] == message['id']
                                ? {...m, 'content': value}
                                : m,
                      )
                      .toList(),
        );
      }
    }
  }

  Widget chat() {
    final query = _search.text.trim().toLowerCase();
    final messages =
        items('messages')
            .where(
              (m) =>
                  (m['content'] ?? '').toString().toLowerCase().contains(query),
            )
            .toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: TextField(
            controller: _search,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              isDense: true,
              prefixIcon: const Icon(Icons.search, size: 18),
              hintText: tr('searchMessages'),
              suffixIcon:
                  query.isEmpty
                      ? null
                      : IconButton(
                        onPressed: () {
                          _search.clear();
                          setState(() {});
                        },
                        icon: const Icon(Icons.close, size: 16),
                      ),
            ),
          ),
        ),
        Expanded(
          child:
              messages.isEmpty
                  ? Center(
                    child: Text(
                      tr(query.isEmpty ? 'emptyChat' : 'noMatchingMessages'),
                    ),
                  )
                  : ReorderableListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: messages.length,
                    buildDefaultDragHandles: false,
                    onReorderItem: (from, to) {
                      if (from == to || _saving) return;
                      final reordered = [...messages];
                      reordered.insert(to, reordered.removeAt(from));
                      final visibleIds = messages.map((m) => m['id']).toSet();
                      var index = 0;
                      save(
                        () =>
                            _doc!['messages'] =
                                items('messages')
                                    .map(
                                      (m) =>
                                          visibleIds.contains(m['id'])
                                              ? reordered[index++]
                                              : m,
                                    )
                                    .toList(),
                      );
                    },
                    itemBuilder: (ctx, index) {
                      final m = messages[index];
                      final self = (m['authorId'] ?? selfId) == selfId;
                      final authorName = name(m['authorId'] ?? selfId);
                      return Padding(
                        key: ValueKey(m['id']),
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          mainAxisAlignment:
                              self
                                  ? MainAxisAlignment.end
                                  : MainAxisAlignment.start,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ReorderableDragStartListener(
                              index: index,
                              child: Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Tooltip(
                                  message: tr('reorderMessage'),
                                  child: const Icon(
                                    Icons.drag_indicator,
                                    size: 18,
                                    color: Colors.grey,
                                  ),
                                ),
                              ),
                            ),
                            if (!self && _doc!['showMemberAvatars'] != false)
                              Padding(
                                padding: const EdgeInsets.only(
                                  right: 6,
                                  top: 4,
                                ),
                                child: CircleAvatar(
                                  radius: 14,
                                  child: Text(
                                    authorName.characters.first,
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                ),
                              ),
                            Flexible(
                              child: GestureDetector(
                                onLongPress: () => messageMenu(m),
                                onSecondaryTap: () => messageMenu(m),
                                child: Container(
                                  constraints: BoxConstraints(
                                    maxWidth:
                                        MediaQuery.sizeOf(context).width * .75,
                                  ),
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color:
                                        self
                                            ? Theme.of(
                                              context,
                                            ).colorScheme.primaryContainer
                                            : Theme.of(context)
                                                .colorScheme
                                                .surfaceContainerHighest,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (!self || _doc!['showTime'] != false)
                                        Padding(
                                          padding: const EdgeInsets.only(
                                            bottom: 4,
                                          ),
                                          child: Wrap(
                                            spacing: 8,
                                            children: [
                                              if (!self)
                                                Text(
                                                  authorName,
                                                  style:
                                                      Theme.of(
                                                        context,
                                                      ).textTheme.labelSmall,
                                                ),
                                              if (_doc!['showTime'] != false)
                                                Text(
                                                  (DateTime.tryParse(
                                                            m['sentAt']
                                                                    ?.toString() ??
                                                                '',
                                                          )?.toLocal().toString() ??
                                                          '')
                                                      .split('.')
                                                      .first,
                                                  style:
                                                      Theme.of(
                                                        context,
                                                      ).textTheme.labelSmall,
                                                ),
                                            ],
                                          ),
                                        ),
                                      _ChannelLinkRichText(
                                        text: m['content']?.toString() ?? '',
                                        style:
                                            Theme.of(
                                              context,
                                            ).textTheme.bodyMedium!,
                                        linkStyle: Theme.of(
                                          context,
                                        ).textTheme.bodyMedium!.copyWith(
                                          color:
                                              Theme.of(
                                                context,
                                              ).colorScheme.primary,
                                          decoration: TextDecoration.underline,
                                        ),
                                        onOpenLink: (href) {
                                          openExternalUrl(href);
                                        },
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              TextField(
                controller: _draft,
                focusNode: _focus,
                minLines: 1,
                maxLines: 6,
                decoration: InputDecoration(
                  hintText: tr('composerPlaceholder'),
                ),
                onSubmitted: (_) => send(),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: Wrap(
                      spacing: 4,
                      children:
                          items('members')
                              .map(
                                (m) => TextButton(
                                  style: TextButton.styleFrom(
                                    visualDensity: VisualDensity.compact,
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                    ),
                                    minimumSize: const Size(0, 28),
                                    foregroundColor:
                                        Theme.of(
                                          context,
                                        ).colorScheme.onSurfaceVariant,
                                    backgroundColor:
                                        _author == m['id']
                                            ? Theme.of(context)
                                                .colorScheme
                                                .surfaceContainerHighest
                                            : Colors.transparent,
                                    textStyle: const TextStyle(fontSize: 11),
                                  ),
                                  onPressed:
                                      () => setState(
                                        () => _author = m['id'].toString(),
                                      ),
                                  child: Text(m['name'].toString()),
                                ),
                              )
                              .toList(),
                    ),
                  ),
                  IconButton(
                    tooltip: tr('send'),
                    onPressed: _saving ? null : send,
                    icon: const Icon(Icons.send_outlined),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> send() async {
    final text = _draft.text.trim();
    if (text.isEmpty || _saving) return;
    final messageId = newId();
    await save(
      () =>
          _doc!['messages'] = [
            ...items('messages'),
            {
              'id': messageId,
              'type': tr('defaultMessageType'),
              'content': text,
              'authorId': _author,
              'sentAt': DateTime.now().toUtc().toIso8601String(),
            },
          ],
    );
    if (mounted && items('messages').any((m) => m['id'] == messageId)) {
      _draft.clear();
      _focus.requestFocus();
    }
  }

  Future<void> addItem() async {
    final tab = _tab;
    final fields = switch (tab) {
      'members' => ['name'],
      'todos' => ['text'],
      'links' => ['url', 'title', 'note'],
      _ => ['name', 'kind', 'uri', 'note'],
    };
    final labels = switch (tab) {
      'members' => ['memberName'],
      'todos' => ['todoPlaceholder'],
      'links' => ['linkUrl', 'linkTitle', 'linkNote'],
      _ => ['resourceName', 'resourceKind', 'resourceUri', 'resourceNote'],
    };
    final controllers = fields.map((_) => TextEditingController()).toList();
    final accepted = await showDialog<bool>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: Text(tr('tabs.$tab')),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(
                  fields.length,
                  (i) => TextField(
                    controller: controllers[i],
                    decoration: InputDecoration(labelText: tr(labels[i])),
                  ),
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text(context.s.commonCancel),
              ),
              TextButton(
                onPressed: () {
                  if (controllers.first.text.trim().isNotEmpty) {
                    Navigator.pop(ctx, true);
                  }
                },
                child: Text(context.s.commonCreate),
              ),
            ],
          ),
    );
    final values = {
      for (var i = 0; i < fields.length; i++)
        fields[i]: controllers[i].text.trim(),
    };
    Future.delayed(const Duration(milliseconds: 300), () {
      for (final c in controllers) {
        c.dispose();
      }
    });
    if (accepted != true || !mounted) return;
    if (tab == 'members' &&
        items(tab).any(
          (m) =>
              m['name'].toString().toLowerCase() ==
              values['name']!.toLowerCase(),
        )) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(tr('memberExists'))));
      return;
    }
    await save(
      () =>
          _doc![tab] = [
            ...items(tab),
            {
              'id': newId(),
              ...values,
              if (tab == 'todos') 'done': false,
              if (tab != 'members')
                'createdAt': DateTime.now().toUtc().toIso8601String(),
            },
          ],
    );
  }

  List<Map<String, String>> parseLinks(String text) {
    final links = <Map<String, String>>[];
    final markdown = RegExp(
      r'^\[([^\]]+)\]\((https?://[^\s)]+)\)(?:\s*[-–—|]\s*(.*))?$',
      caseSensitive: false,
    );
    final pipe = RegExp(
      r'^(.*?)\s*\|\s*(https?://[^\s|<>]+)(?:\s*\|\s*(.*))?$',
      caseSensitive: false,
    );
    final dash = RegExp(
      r'^(.*?)\s+[-–—]\s+(https?://[^\s|<>]+)$',
      caseSensitive: false,
    );
    for (final raw in text.split(RegExp(r'\r?\n'))) {
      final line = raw.trim();
      if (line.isEmpty) continue;
      final match =
          markdown.firstMatch(line) ??
          pipe.firstMatch(line) ??
          dash.firstMatch(line);
      final url =
          match?.group(2) ??
          (RegExp(r'^https?://\S+$', caseSensitive: false).hasMatch(line)
              ? line
              : '');
      final uri = Uri.tryParse(url);
      if (uri == null ||
          !uri.hasAuthority ||
          !['http', 'https'].contains(uri.scheme.toLowerCase())) {
        continue;
      }
      links.add({
        'url': url,
        'title':
            (match?.group(1) ?? '').trim().isEmpty
                ? uri.host
                : match!.group(1)!.trim(),
        'note': (match?.group(3) ?? '').trim(),
      });
    }
    return links;
  }

  Future<void> importLinks(String text) async {
    final parsed = parseLinks(text);
    if (parsed.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(tr('noImportableLinks'))));
      return;
    }
    await save(
      () =>
          _doc!['links'] = [
            ...items('links'),
            for (var i = 0; i < parsed.length; i++)
              {
                'id': '${newId()}-$i',
                ...parsed[i],
                'createdAt': DateTime.now().toUtc().toIso8601String(),
              },
          ],
    );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            tr('linksImported').replaceAll('{count}', '${parsed.length}'),
          ),
        ),
      );
    }
  }

  Future<void> bulkImportLinks() async {
    final controller = TextEditingController();
    final text = await showDialog<String>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: Text(tr('bulkImportLinks')),
            content: SizedBox(
              width: 500,
              child: TextField(
                controller: controller,
                autofocus: true,
                minLines: 8,
                maxLines: 12,
                decoration: InputDecoration(
                  hintText: tr('bulkImportPlaceholder'),
                  helperText: tr('bulkImportHint'),
                  helperMaxLines: 4,
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text(context.s.commonCancel),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, controller.text),
                child: Text(tr('startImport')),
              ),
            ],
          ),
    );
    Future.delayed(const Duration(milliseconds: 300), controller.dispose);
    if (text != null && mounted) await importLinks(text);
  }

  Future<void> editLink(Map<String, dynamic> item) async {
    final fields = ['url', 'title', 'note'];
    final controllers = [
      for (final field in fields)
        TextEditingController(text: (item[field] ?? '').toString()),
    ];
    final accepted = await showDialog<bool>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: Text(tr('editLink')),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < fields.length; i++)
                  TextField(
                    controller: controllers[i],
                    decoration: InputDecoration(
                      labelText: tr(['linkUrl', 'linkTitle', 'linkNote'][i]),
                    ),
                  ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text(context.s.commonCancel),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(tr('saveLink')),
              ),
            ],
          ),
    );
    final values = {
      for (var i = 0; i < fields.length; i++)
        fields[i]: controllers[i].text.trim(),
    };
    Future.delayed(const Duration(milliseconds: 300), () {
      for (final c in controllers) {
        c.dispose();
      }
    });
    if (accepted == true && values['url']!.isNotEmpty && mounted) {
      await save(
        () =>
            _doc!['links'] = [
              for (final link in items('links'))
                link['id'] == item['id'] ? {...link, ...values} : link,
            ],
      );
    }
  }

  String markdownLink(Map<String, dynamic> item) {
    final url = item['url'].toString();
    final title = (item['title'] ?? '').toString();
    return '[${(title.isEmpty ? url : title).replaceAllMapped(RegExp(r'([\\\]])'), (m) => '\\${m[0]}')}]($url)';
  }

  Future<void> copyLinks(String text) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(tr('linksCopied'))));
    }
  }

  String todoGroupId(
    Map<String, dynamic> task,
    List<Map<String, dynamic>> groups,
  ) {
    final id = (task['groupId'] ?? '').toString();
    return groups.any((group) => group['id'] == id) ? id : '';
  }

  Future<void> addTodo([String groupId = '']) async {
    final text = _todoDraft.text.trim();
    if (text.isEmpty) return;
    await save(
      () =>
          _doc!['todos'] = [
            ...items('todos'),
            {
              'id': newId(),
              'text': text,
              'done': false,
              'createdAt': DateTime.now().toUtc().toIso8601String(),
              if (groupId.isNotEmpty) 'groupId': groupId,
            },
          ],
    );
    if (mounted) _todoDraft.clear();
  }

  Future<void> addTodoToGroup(String groupId) async {
    final text = await prompt(todoTr('quickPlaceholder'));
    if (text == null || text.trim().isEmpty || !mounted) return;
    await save(
      () =>
          _doc!['todos'] = [
            ...items('todos'),
            {
              'id': newId(),
              'text': text.trim(),
              'done': false,
              'createdAt': DateTime.now().toUtc().toIso8601String(),
              if (groupId.isNotEmpty) 'groupId': groupId,
            },
          ],
    );
  }

  Future<void> addTodoGroup({String? anchor, bool before = false}) async {
    final name = await prompt(todoTr('groupName'));
    if (name == null || name.trim().isEmpty || !mounted) return;
    await save(() {
      final groups = items('todoGroups');
      final index = groups.indexWhere((group) => group['id'] == anchor);
      groups.insert(index < 0 ? groups.length : index + (before ? 0 : 1), {
        'id': newId(),
        'name': name.trim(),
        'collapsed': false,
      });
      _doc!['todoGroups'] = groups;
    });
  }

  Future<void> deleteTodosWithUndo({String? taskId, String? groupId}) async {
    final beforeTasks = items('todos');
    final beforeGroups = items('todoGroups');
    final count =
        groupId != null
            ? beforeTasks.where((task) => task['groupId'] == groupId).length
            : 1;
    await save(() {
      _doc!['todos'] =
          beforeTasks
              .where(
                (task) =>
                    task['id'] != taskId &&
                    (groupId == null || task['groupId'] != groupId),
              )
              .toList();
      if (groupId != null) {
        _doc!['todoGroups'] =
            beforeGroups.where((group) => group['id'] != groupId).toList();
      }
    });
    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          todoTr(
            groupId != null ? 'groupDeleted' : 'deleted',
          ).replaceAll('{count}', '$count'),
        ),
        action: SnackBarAction(
          label: todoTr('undo'),
          onPressed:
              () => save(() {
                _doc!['todos'] = beforeTasks;
                _doc!['todoGroups'] = beforeGroups;
              }),
        ),
      ),
    );
  }

  Future<void> todoAction(Map<String, dynamic> task, String action) async {
    final id = task['id'];
    if (action == 'edit') {
      final value = await prompt(
        todoTr('edit'),
        (task['text'] ?? '').toString(),
      );
      if (value != null && value.trim().isNotEmpty && mounted) {
        await save(
          () =>
              _doc!['todos'] = [
                for (final item in items('todos'))
                  item['id'] == id ? {...item, 'text': value.trim()} : item,
              ],
        );
      }
    } else if (action == 'delete') {
      await deleteTodosWithUndo(taskId: id.toString());
    } else if (action == 'source') {
      final source =
          items('messages')
              .where((message) => message['id'] == task['sourceMessageId'])
              .firstOrNull;
      if (source == null) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(todoTr('sourceMissing'))));
      } else {
        setState(() {
          _tab = 'chat';
          _search.text = (source['content'] ?? '').toString();
        });
      }
    } else if (action.startsWith('move:')) {
      final groupId = action.substring(5);
      await save(
        () =>
            _doc!['todos'] = [
              for (final item in items('todos'))
                item['id'] == id
                    ? ({...item}
                      ..remove('groupId')
                      ..addAll(groupId.isEmpty ? {} : {'groupId': groupId}))
                    : item,
            ],
      );
    }
  }

  Widget todoTask(
    Map<String, dynamic> task,
    int index,
    List<Map<String, dynamic>> groups,
  ) => ListTile(
    key: ValueKey('todo:${task['id']}'),
    leading: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ReorderableDragStartListener(
          index: index,
          child: const Icon(Icons.drag_handle),
        ),
        Checkbox(
          value: task['done'] == true,
          onChanged:
              _saving
                  ? null
                  : (value) => save(
                    () =>
                        _doc!['todos'] = [
                          for (final item in items('todos'))
                            item['id'] == task['id']
                                ? {
                                  ...item,
                                  'done': value,
                                  'completedAt':
                                      value == true
                                          ? DateTime.now()
                                              .toUtc()
                                              .toIso8601String()
                                          : null,
                                }
                                : item,
                        ],
                  ),
        ),
      ],
    ),
    title: Text(
      (task['text'] ?? '').toString(),
      style: TextStyle(
        decoration: task['done'] == true ? TextDecoration.lineThrough : null,
      ),
    ),
    onTap: () => todoAction(task, 'edit'),
    trailing: PopupMenuButton<String>(
      tooltip: todoTr('groupMenu'),
      onSelected: (action) => todoAction(task, action),
      itemBuilder:
          (_) => [
            PopupMenuItem(value: 'edit', child: Text(todoTr('edit'))),
            if (task['sourceMessageId'] != null)
              PopupMenuItem(value: 'source', child: Text(todoTr('source'))),
            if (groups.isNotEmpty) ...[
              PopupMenuItem(enabled: false, child: Text(todoTr('moveTo'))),
              PopupMenuItem(value: 'move:', child: Text(todoTr('ungrouped'))),
              for (final group in groups)
                PopupMenuItem(
                  value: 'move:${group['id']}',
                  child: Text(group['name'].toString()),
                ),
            ],
            PopupMenuItem(value: 'delete', child: Text(todoTr('delete'))),
          ],
    ),
  );

  Widget todoSection(
    String groupId,
    String name,
    bool collapsed,
    List<Map<String, dynamic>> groups, {
    bool plain = false,
    int? groupIndex,
  }) {
    final tasks =
        items(
          'todos',
        ).where((task) => todoGroupId(task, groups) == groupId).toList();
    return Column(
      key: ValueKey('group:$groupId'),
      children: [
        if (!plain)
          ListTile(
            leading:
                groupIndex == null
                    ? null
                    : ReorderableDragStartListener(
                      index: groupIndex,
                      child: const Icon(Icons.drag_handle),
                    ),
            title: Text('$name (${tasks.length})'),
            onTap: () {
              if (groupId.isEmpty) {
                setState(() => _ungroupedCollapsed = !_ungroupedCollapsed);
              } else {
                save(
                  () =>
                      _doc!['todoGroups'] = [
                        for (final group in groups)
                          group['id'] == groupId
                              ? {...group, 'collapsed': !collapsed}
                              : group,
                      ],
                );
              }
            },
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  tooltip: tr('addTodo'),
                  icon: const Icon(Icons.add),
                  onPressed: () => addTodoToGroup(groupId),
                ),
                if (groupId.isNotEmpty)
                  PopupMenuButton<String>(
                    tooltip: todoTr('groupMenu'),
                    onSelected: (action) async {
                      if (action == 'rename') {
                        final value = await prompt(todoTr('groupName'), name);
                        if (value != null &&
                            value.trim().isNotEmpty &&
                            mounted) {
                          await save(
                            () =>
                                _doc!['todoGroups'] = [
                                  for (final group in items('todoGroups'))
                                    group['id'] == groupId
                                        ? {...group, 'name': value.trim()}
                                        : group,
                                ],
                          );
                        }
                      }
                      if (action == 'above') {
                        await addTodoGroup(anchor: groupId, before: true);
                      }
                      if (action == 'below') {
                        await addTodoGroup(anchor: groupId);
                      }
                      if (action == 'delete') {
                        await deleteTodosWithUndo(groupId: groupId);
                      }
                    },
                    itemBuilder:
                        (_) => [
                          PopupMenuItem(
                            value: 'rename',
                            child: Text(context.s.commonRename),
                          ),
                          PopupMenuItem(
                            value: 'above',
                            child: Text(todoTr('addGroupAbove')),
                          ),
                          PopupMenuItem(
                            value: 'below',
                            child: Text(todoTr('addGroupBelow')),
                          ),
                          PopupMenuItem(
                            value: 'delete',
                            child: Text(todoTr('deleteGroup')),
                          ),
                        ],
                  ),
              ],
            ),
          ),
        if (!collapsed)
          ReorderableListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            buildDefaultDragHandles: false,
            itemCount: tasks.length,
            onReorderItem: (oldIndex, newIndex) {
              if (_saving) return;
              save(() {
                final all = items('todos');
                final moving = tasks[oldIndex];
                all.removeWhere((task) => task['id'] == moving['id']);
                final target =
                    newIndex < tasks.length - 1
                        ? tasks
                            .where((task) => task['id'] != moving['id'])
                            .toList()[newIndex]
                        : null;
                final at =
                    target == null
                        ? all.length
                        : all.indexWhere((task) => task['id'] == target['id']);
                all.insert(at, moving);
                _doc!['todos'] = all;
              });
            },
            itemBuilder: (_, index) => todoTask(tasks[index], index, groups),
          ),
      ],
    );
  }

  Widget todosPanel() {
    final groups = items('todoGroups');
    final showGroups =
        groups.isNotEmpty ||
        items(
          'todos',
        ).any((task) => (task['groupId'] ?? '').toString().isNotEmpty);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _todoDraft,
                  decoration: InputDecoration(
                    hintText: todoTr('quickPlaceholder'),
                  ),
                  onSubmitted: (_) => addTodo(),
                ),
              ),
              IconButton(
                tooltip: tr('addTodo'),
                onPressed: _saving ? null : addTodo,
                icon: const Icon(Icons.add),
              ),
              TextButton(
                onPressed: _saving ? null : () => addTodoGroup(),
                child: Text(todoTr('addGroup')),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            children: [
              todoSection(
                '',
                todoTr('ungrouped'),
                _ungroupedCollapsed,
                groups,
                plain: !showGroups,
              ),
              if (groups.isNotEmpty)
                ReorderableListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  buildDefaultDragHandles: false,
                  itemCount: groups.length,
                  onReorderItem: (oldIndex, newIndex) {
                    if (_saving) return;
                    save(() {
                      final next = items('todoGroups');
                      next.insert(newIndex, next.removeAt(oldIndex));
                      _doc!['todoGroups'] = next;
                    });
                  },
                  itemBuilder:
                      (_, index) => KeyedSubtree(
                        key: ValueKey('sort-group:${groups[index]['id']}'),
                        child: todoSection(
                          groups[index]['id'].toString(),
                          groups[index]['name'].toString(),
                          groups[index]['collapsed'] == true,
                          groups,
                          groupIndex: index,
                        ),
                      ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget linksPanel() => Column(
    children: [
      Wrap(
        alignment: WrapAlignment.end,
        children: [
          TextButton.icon(
            onPressed: _saving ? null : addItem,
            icon: const Icon(Icons.add),
            label: Text(tr('addLink')),
          ),
          TextButton.icon(
            onPressed:
                _saving
                    ? null
                    : () async {
                      try {
                        final data = await Clipboard.getData('text/plain');
                        if (mounted) await importLinks(data?.text ?? '');
                      } catch (_) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(tr('clipboardReadFailed'))),
                          );
                        }
                      }
                    },
            icon: const Icon(Icons.paste),
            label: Text(tr('importFromClipboard')),
          ),
          TextButton(
            onPressed: _saving ? null : bulkImportLinks,
            child: Text(tr('bulkImportLinks')),
          ),
          if (items('links').isNotEmpty)
            TextButton(
              onPressed:
                  () => copyLinks(items('links').map(markdownLink).join('\n')),
              child: Text(tr('copyAllMarkdownLinks')),
            ),
        ],
      ),
      Expanded(
        child: ReorderableListView.builder(
          buildDefaultDragHandles: false,
          itemCount: items('links').length,
          onReorderItem: (oldIndex, newIndex) {
            if (_saving) return;
            save(() {
              final links = items('links');
              links.insert(newIndex, links.removeAt(oldIndex));
              _doc!['links'] = links;
            });
          },
          itemBuilder: (context, index) {
            final item = items('links')[index];
            final url = (item['url'] ?? '').toString();
            final title = (item['title'] ?? '').toString();
            return ListTile(
              key: ValueKey(item['id']),
              leading: ReorderableDragStartListener(
                index: index,
                child: const Icon(Icons.drag_handle),
              ),
              title: Text(title.isEmpty ? url : title),
              subtitle: Text(
                [
                  if (title.isNotEmpty) url,
                  if ((item['note'] ?? '').toString().isNotEmpty) item['note'],
                ].join('\n'),
              ),
              onTap: isExternalHref(url) ? () => openExternalUrl(url) : null,
              trailing: PopupMenuButton<String>(
                tooltip: tr('linkActions'),
                onSelected: (action) {
                  switch (action) {
                    case 'edit':
                      editLink(item);
                    case 'markdown':
                      copyLinks(markdownLink(item));
                    case 'pipe':
                      copyLinks('${title.isEmpty ? url : title} | $url');
                    case 'dash':
                      copyLinks('${title.isEmpty ? url : title} - $url');
                    case 'delete':
                      save(
                        () =>
                            _doc!['links'] =
                                items('links')
                                    .where((link) => link['id'] != item['id'])
                                    .toList(),
                      );
                  }
                },
                itemBuilder:
                    (_) => [
                      PopupMenuItem(value: 'edit', child: Text(tr('editLink'))),
                      PopupMenuItem(
                        value: 'markdown',
                        child: Text(tr('copyMarkdownLink')),
                      ),
                      PopupMenuItem(
                        value: 'pipe',
                        child: Text(tr('copyTitlePipeLink')),
                      ),
                      PopupMenuItem(
                        value: 'dash',
                        child: Text(tr('copyTitleDashLink')),
                      ),
                      PopupMenuItem(
                        value: 'delete',
                        child: Text(tr('deleteLink')),
                      ),
                    ],
              ),
            );
          },
        ),
      ),
    ],
  );

  Widget sidePanel() {
    if (_tab == 'todos') return todosPanel();
    if (_tab == 'links') return linksPanel();
    if (_tab == 'settings') {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final key in ['title', 'subtitle'])
            ListTile(
              title: Text(tr('settings.$key')),
              subtitle: Text(_doc![key]?.toString() ?? ''),
              trailing: const Icon(Icons.edit_outlined),
              onTap: () async {
                final value = await prompt(
                  tr('settings.$key'),
                  _doc![key]?.toString() ?? '',
                );
                if (value != null && mounted) {
                  await save(() => _doc![key] = value);
                }
              },
            ),
          for (final key in ['showTime', 'showMemberAvatars'])
            SwitchListTile(
              title: Text(tr(key)),
              value: _doc![key] != false,
              onChanged:
                  _saving ? null : (value) => save(() => _doc![key] = value),
            ),
        ],
      );
    }
    final tab = _tab;
    return Column(
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: _saving ? null : addItem,
            icon: const Icon(Icons.add),
            label: Text(
              tr(switch (tab) {
                'members' => 'addMember',
                'todos' => 'addTodo',
                'links' => 'addLink',
                _ => 'addResource',
              }),
            ),
          ),
        ),
        Expanded(
          child: ListView(
            children:
                items(tab).map((item) {
                  final uri =
                      (item[tab == 'links' ? 'url' : 'uri'] ?? '').toString();
                  return ListTile(
                    leading:
                        tab == 'todos'
                            ? Checkbox(
                              value: item['done'] == true,
                              onChanged:
                                  _saving
                                      ? null
                                      : (v) => save(
                                        () =>
                                            _doc![tab] =
                                                items(tab)
                                                    .map(
                                                      (m) =>
                                                          m['id'] == item['id']
                                                              ? {
                                                                ...m,
                                                                'done': v,
                                                              }
                                                              : m,
                                                    )
                                                    .toList(),
                                      ),
                            )
                            : null,
                    title: Text(
                      (item['name'] ??
                              item['text'] ??
                              ((item['title'] ?? '').toString().isEmpty
                                  ? item['url']
                                  : item['title']) ??
                              '')
                          .toString(),
                    ),
                    subtitle:
                        tab == 'members'
                            ? (item['isSelf'] == true
                                ? Text(tr('selfBadge'))
                                : null)
                            : Text(
                              [uri, item['kind'] ?? '', item['note'] ?? '']
                                  .where((v) => v.toString().isNotEmpty)
                                  .join('\n'),
                            ),
                    onTap:
                        tab == 'members'
                            ? () async {
                              final value = await prompt(
                                tr('memberName'),
                                item['name'].toString(),
                              );
                              if (value != null &&
                                  value.trim().isNotEmpty &&
                                  mounted) {
                                await save(
                                  () =>
                                      _doc![tab] =
                                          items(tab)
                                              .map(
                                                (m) =>
                                                    m['id'] == item['id']
                                                        ? {
                                                          ...m,
                                                          'name': value.trim(),
                                                        }
                                                        : m,
                                              )
                                              .toList(),
                                );
                              }
                            }
                            : isExternalHref(uri)
                            ? () => openExternalUrl(uri)
                            : null,
                    trailing:
                        item['isSelf'] == true
                            ? null
                            : IconButton(
                              tooltip: context.s.commonDelete,
                              icon: const Icon(Icons.delete_outline, size: 18),
                              onPressed:
                                  _saving
                                      ? null
                                      : () => save(() {
                                        _doc![tab] =
                                            items(tab)
                                                .where(
                                                  (m) => m['id'] != item['id'],
                                                )
                                                .toList();
                                        if (tab == 'members') {
                                          _doc!['messages'] =
                                              items('messages')
                                                  .map(
                                                    (m) =>
                                                        m['authorId'] ==
                                                                item['id']
                                                            ? {
                                                              ...m,
                                                              'authorId':
                                                                  selfId,
                                                            }
                                                            : m,
                                                  )
                                                  .toList();
                                          if (_author == item['id']) {
                                            _author = selfId;
                                          }
                                        }
                                      }),
                            ),
                  );
                }).toList(),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: Column(
      children: [
        ListTile(
          leading:
              widget.showDirectoryButton
                  ? IconButton(
                    tooltip: context.s.openDirectory,
                    icon: const Icon(Icons.menu),
                    onPressed: () => Scaffold.of(context).openDrawer(),
                  )
                  : null,
          title: Text(
            (_doc?['title'] ?? '').toString().trim().isEmpty
                ? widget.notebook.name
                : _doc!['title'].toString(),
          ),
          subtitle: Text((_doc?['subtitle'] ?? '').toString()),
        ),
        if (_doc == null)
          Expanded(child: SelectableText(widget.notebook.documentContent))
        else ...[
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children:
                  _tabs
                      .map(
                        (tab) => TextButton(
                          onPressed: () {
                            setState(() => _tab = tab);
                            if (tab == 'chat') {
                              WidgetsBinding.instance.addPostFrameCallback((_) {
                                if (mounted) _focus.requestFocus();
                              });
                            }
                          },
                          child: Text(
                            tr('tabs.$tab'),
                            style: TextStyle(
                              fontWeight:
                                  tab == _tab
                                      ? FontWeight.bold
                                      : FontWeight.normal,
                            ),
                          ),
                        ),
                      )
                      .toList(),
            ),
          ),
          Expanded(child: _tab == 'chat' ? chat() : sidePanel()),
        ],
      ],
    ),
  );
}

class _ChannelLinkRichText extends StatefulWidget {
  const _ChannelLinkRichText({
    required this.text,
    required this.style,
    required this.linkStyle,
    required this.onOpenLink,
  });

  final String text;
  final TextStyle style;
  final TextStyle linkStyle;
  final void Function(String href) onOpenLink;

  @override
  State<_ChannelLinkRichText> createState() => _ChannelLinkRichTextState();
}

class _ChannelLinkRichTextState extends State<_ChannelLinkRichText> {
  final _recognizers = <TapGestureRecognizer>[];

  @override
  void dispose() {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    _recognizers.clear();

    final spans = <InlineSpan>[];
    var lastIndex = 0;
    for (final match in RegExp(
      r'https?://[^\s<>]+|mailto:[^\s<>]+',
    ).allMatches(widget.text)) {
      final href = match.group(0)!;
      final start = match.start;
      if (start > lastIndex) {
        spans.add(
          TextSpan(
            text: widget.text.substring(lastIndex, start),
            style: widget.style,
          ),
        );
      }
      if (isExternalHref(href)) {
        final recognizer =
            TapGestureRecognizer()..onTap = () => widget.onOpenLink(href);
        _recognizers.add(recognizer);
        spans.add(
          TextSpan(text: href, style: widget.linkStyle, recognizer: recognizer),
        );
      } else {
        spans.add(TextSpan(text: href, style: widget.style));
      }
      lastIndex = match.end;
    }
    if (lastIndex < widget.text.length) {
      spans.add(
        TextSpan(text: widget.text.substring(lastIndex), style: widget.style),
      );
    }
    if (spans.isEmpty) {
      spans.add(TextSpan(text: widget.text, style: widget.style));
    }

    return SelectableText.rich(TextSpan(children: spans));
  }
}
