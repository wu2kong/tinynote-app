import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../constants/pro.dart';
import '../l10n/l10n.dart';
import '../services/git_providers.dart';
import '../services/library_service.dart';
import '../services/license_store.dart';
import '../theme/app_colors.dart';
import '../utils/open_url.dart';
import 'app_toast.dart';
import 'pro_upgrade_sheet.dart';

Future<void> showGitSyncSheet({
  required BuildContext context,
  required LibraryService library,
}) {
  final license = LicenseScope.maybeOf(context);
  if (license != null && !license.isPro) {
    return showProUpgradeSheet(
      context: context,
      library: library,
      feature: ProFeature.sync,
    );
  }
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: context.colors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (context) => GitSyncSheet(library: library),
  );
}

class GitSyncSheet extends StatefulWidget {
  const GitSyncSheet({super.key, required this.library});

  final LibraryService library;

  @override
  State<GitSyncSheet> createState() => _GitSyncSheetState();
}

class _GitSyncSheetState extends State<GitSyncSheet> {
  late final TextEditingController _url;
  late final TextEditingController _token;
  late final TextEditingController _username;
  var _obscureToken = true;

  LibraryService get library => widget.library;

  @override
  void initState() {
    super.initState();
    final config = library.gitConfig;
    _url = TextEditingController(text: config.url);
    _token = TextEditingController(text: config.token);
    _username = TextEditingController(text: config.username);
    library.addListener(_onLibraryChanged);
    library.refreshGitStatus();
  }

  @override
  void dispose() {
    library.removeListener(_onLibraryChanged);
    _url.dispose();
    _token.dispose();
    _username.dispose();
    super.dispose();
  }

  void _onLibraryChanged() {
    if (!mounted) return;
    setState(() {});
  }

  Future<void> _toastResult() async {
    final message = library.syncMessage;
    if (!mounted || message == null || message.isEmpty) return;
    showAppToast(context, message);
  }

  Future<void> _connect() async {
    final s = context.s;
    final url = _url.text.trim();
    final token = _token.text.trim();
    if (url.isEmpty) {
      showAppToast(context, s.gitSyncUrlRequired);
      return;
    }
    if (token.isEmpty) {
      showAppToast(context, s.gitSyncTokenRequired);
      return;
    }
    try {
      await library.connectGit(
        url: url,
        token: token,
        username: _username.text,
      );
      await _toastResult();
    } catch (_) {
      await _toastResult();
    }
  }

  Future<void> _pull() async {
    try {
      final copies = await library.pullGit();
      if (!mounted) return;
      await _toastResult();
      if (!mounted) return;
      if (copies.isNotEmpty) {
        showAppToast(context, context.s.gitSyncConflictHint);
      }
    } catch (_) {
      await _toastResult();
    }
  }

  Future<void> _push() async {
    try {
      await library.pushGit();
      await _toastResult();
    } catch (_) {
      await _toastResult();
    }
  }

  Future<void> _disconnect() async {
    final s = context.s;
    final colors = context.colors;
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: Text(s.gitSyncDisconnectTitle),
            content: Text(s.gitSyncDisconnectMessage),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: Text(s.commonCancel),
              ),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: colors.accent),
                onPressed: () => Navigator.of(context).pop(true),
                child: Text(s.gitSyncDisconnect),
              ),
            ],
          ),
    );
    if (confirmed != true) return;
    try {
      await library.disconnectGit();
      _url.clear();
      _token.clear();
      _username.clear();
      await _toastResult();
    } catch (_) {
      await _toastResult();
    }
  }

  Future<void> _openTokenPage() async {
    final url = tokenCreateUrl(inferGitProvider(_url.text));
    if (url.isEmpty) return;
    final opened = await openExternalUrl(url);
    if (!opened && mounted) {
      showAppToast(context, context.s.openHelpDocsFailed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final safeBottom = MediaQuery.paddingOf(context).bottom;
    final maxHeight = MediaQuery.sizeOf(context).height * 0.9;
    final connected = library.gitConnected;
    final busy = library.syncBusy;
    final tokenPage = tokenCreateUrl(inferGitProvider(_url.text));

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(bottom: bottom),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxHeight),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        s.gitSync,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: colors.title,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: s.commonClose,
                      visualDensity: VisualDensity.compact,
                      onPressed: () => Navigator.of(context).pop(),
                      icon: Icon(LucideIcons.x, size: 18, color: colors.muted),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + safeBottom),
                  children: [
                    Text(
                      s.gitSyncDesc,
                      style: TextStyle(fontSize: 13, height: 1.35, color: colors.body),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      s.gitSyncHttpsOnly,
                      style: TextStyle(fontSize: 12, height: 1.35, color: colors.muted),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _url,
                      enabled: !busy,
                      keyboardType: TextInputType.url,
                      autocorrect: false,
                      decoration: InputDecoration(
                        labelText: s.gitSyncUrl,
                        hintText: s.gitSyncUrlHint,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _token,
                      enabled: !busy,
                      obscureText: _obscureToken,
                      autocorrect: false,
                      enableSuggestions: false,
                      decoration: InputDecoration(
                        labelText: s.gitSyncToken,
                        hintText: s.gitSyncTokenHint,
                        suffixIcon: IconButton(
                          tooltip: s.gitSyncToken,
                          onPressed:
                              () => setState(() => _obscureToken = !_obscureToken),
                          icon: Icon(
                            _obscureToken ? LucideIcons.eye : LucideIcons.eyeOff,
                            size: 18,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _username,
                      enabled: !busy,
                      autocorrect: false,
                      decoration: InputDecoration(labelText: s.gitSyncUsername),
                    ),
                    if (tokenPage.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          onPressed: busy ? null : _openTokenPage,
                          icon: Icon(
                            LucideIcons.externalLink,
                            size: 16,
                            color: colors.accent,
                          ),
                          label: Text(s.gitSyncOpenTokenPage),
                        ),
                      ),
                    ],
                    if (connected && library.gitStatus.remoteUrl != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        library.gitStatus.remoteUrl!,
                        style: TextStyle(fontSize: 12, color: colors.body),
                      ),
                      if (library.gitStatus.branch != null)
                        Text(
                          library.gitStatus.branch!,
                          style: TextStyle(fontSize: 12, color: colors.muted),
                        ),
                    ],
                    if (busy) ...[
                      const SizedBox(height: 12),
                      LinearProgressIndicator(
                        minHeight: 2,
                        color: colors.accent,
                        backgroundColor: colors.accentSoft,
                      ),
                      if (library.syncMessage != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          library.syncMessage!,
                          style: TextStyle(fontSize: 12, color: colors.body),
                        ),
                      ],
                    ],
                    const SizedBox(height: 16),
                    if (!connected)
                      FilledButton(
                        onPressed: busy ? null : _connect,
                        child: Text(s.gitSyncConnect),
                      )
                    else ...[
                      FilledButton(
                        onPressed: busy ? null : _pull,
                        child: Text(s.gitSyncPull),
                      ),
                      const SizedBox(height: 8),
                      FilledButton.tonal(
                        onPressed: busy ? null : _push,
                        child: Text(s.gitSyncPush),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: busy ? null : _disconnect,
                        child: Text(s.gitSyncDisconnect),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
