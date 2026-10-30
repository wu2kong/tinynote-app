import 'package:flutter/gestures.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
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
  final _search = TextEditingController();
  final _focus = FocusNode();
  Map<String, dynamic>? _doc;
  String _synced = '';
  String _tab = 'chat';
  String _author = 'self';
  bool _saving = false;
  static const _tabs = [
    'chat',
    'todos',
    'links',
    'resources',
    'members',
    'settings',
  ];
  String tr(String key) => context.s.ch(key);
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

  Widget sidePanel() {
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
