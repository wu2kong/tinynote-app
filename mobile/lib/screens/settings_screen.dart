import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../utils/open_url.dart';

import '../constants/app.dart';
import '../l10n/l10n.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';
import '../widgets/app_toast.dart';
import '../widgets/sheet_drag_area.dart';

const _settingsPreviewSize = 0.75;
const _settingsFullSize = 1.0;

Future<void> showSettingsSheet({
  required BuildContext context,
  required LibraryService library,
}) {
  // Keep the left drawer open (same as space picker). Restate host insets because
  // ModalBottomSheet(useSafeArea:false) zeros top padding/viewPadding.
  final hostPadding = MediaQuery.paddingOf(context);
  final hostViewPadding = MediaQuery.viewPaddingOf(context);

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    isDismissible: true,
    enableDrag: true,
    useSafeArea: false,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.35),
    builder: (context) {
      return MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(padding: hostPadding, viewPadding: hostViewPadding),
        child: SettingsScreen(library: library),
      );
    },
  );
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, required this.library});

  final LibraryService library;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _sheetController = DraggableScrollableController();
  var _isFull = false;

  LibraryService get library => widget.library;

  @override
  void initState() {
    super.initState();
    library.addListener(_onLibraryChanged);
    library.refreshICloudStatus();
    _sheetController.addListener(_onSheetSizeChanged);
  }

  @override
  void dispose() {
    _sheetController.removeListener(_onSheetSizeChanged);
    _sheetController.dispose();
    library.removeListener(_onLibraryChanged);
    super.dispose();
  }

  void _onLibraryChanged() {
    if (mounted) setState(() {});
  }

  void _onSheetSizeChanged() {
    if (!_sheetController.isAttached) return;
    final nextFull = _sheetController.size >= 0.92;
    if (nextFull != _isFull) {
      setState(() => _isFull = nextFull);
    }
  }

  Future<void> _toggleICloud(bool enabled) async {
    if (library.syncBusy) return;
    final colors = context.colors;
    final s = context.s;

    try {
      if (enabled) {
        final confirmed = await showDialog<bool>(
          context: context,
          builder:
              (context) => AlertDialog(
                title: Text(s.enableSyncTitle),
                content: Text(s.enableSyncMessage),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(false),
                    child: Text(s.commonCancel),
                  ),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: colors.accent,
                    ),
                    onPressed: () => Navigator.of(context).pop(true),
                    child: Text(s.commonSelectFolder),
                  ),
                ],
              ),
        );
        if (confirmed != true || !mounted) return;
        await library.enableICloudSync();
      } else {
        final confirmed = await showDialog<bool>(
          context: context,
          builder:
              (context) => AlertDialog(
                title: Text(s.disableSyncTitle),
                content: Text(s.disableSyncMessage),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(false),
                    child: Text(s.commonCancel),
                  ),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: colors.accent,
                    ),
                    onPressed: () => Navigator.of(context).pop(true),
                    child: Text(s.commonTurnOffSync),
                  ),
                ],
              ),
        );
        if (confirmed != true || !mounted) return;
        await library.disableICloudSync();
      }

      if (!mounted) return;
      final message = library.syncMessage;
      if (message != null && message.isNotEmpty) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(message)));
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('$error')));
    }
  }

  Future<void> _changeFolder() async {
    try {
      await library.changeICloudFolder();
      if (!mounted) return;
      final message = library.syncMessage;
      if (message != null && message.isNotEmpty) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(message)));
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('$error')));
    }
  }

  Future<void> _openExternalUrl(
    String url, {
    required String failureMessage,
  }) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      if (mounted) showAppToast(context, failureMessage);
      return;
    }

    final opened = await openExternalUrl(url);
    if (!opened && mounted) {
      showAppToast(context, failureMessage);
    }
  }

  Future<void> _pickColorTheme(ThemeController theme) async {
    final colors = context.colors;
    final s = context.s;
    final selected = await showModalBottomSheet<ColorThemeId>(
      context: context,
      backgroundColor: colors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        final sheetColors = context.colors;
        final maxHeight = MediaQuery.sizeOf(context).height * 0.7;
        return SafeArea(
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
                    color: sheetColors.border,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      s.colorTheme,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: sheetColors.title,
                      ),
                    ),
                  ),
                ),
                Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    children: [
                      for (final item in ColorThemeId.values)
                        ListTile(
                          leading: _ThemeSwatch(
                            themeId: item,
                            isDark: theme.isDark,
                          ),
                          title: Text(
                            item.labelFor(s),
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: sheetColors.title,
                            ),
                          ),
                          subtitle: Text(
                            item.descriptionFor(s),
                            style: TextStyle(
                              fontSize: 12,
                              color: sheetColors.body,
                            ),
                          ),
                          trailing:
                              item == theme.colorThemeId
                                  ? Icon(
                                    LucideIcons.check,
                                    size: 18,
                                    color: sheetColors.accent,
                                  )
                                  : null,
                          onTap: () => Navigator.of(context).pop(item),
                        ),
                      const SizedBox(height: 8),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
    if (selected != null) {
      await theme.setColorTheme(selected);
    }
  }

  Future<void> _pickLocale() async {
    final colors = context.colors;
    final controller = context.l10n;
    final selected = await showModalBottomSheet<AppLocale>(
      context: context,
      backgroundColor: colors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        final sheetColors = context.colors;
        final current = controller.locale;
        final maxHeight = MediaQuery.sizeOf(context).height * 0.7;
        return SafeArea(
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
                    color: sheetColors.border,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    children: [
                      for (final locale in AppLocale.values)
                        ListTile(
                          title: Text(
                            locale.nativeLabel,
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: sheetColors.title,
                            ),
                          ),
                          trailing:
                              locale == current
                                  ? Icon(
                                    LucideIcons.check,
                                    size: 18,
                                    color: sheetColors.accent,
                                  )
                                  : null,
                          onTap: () => Navigator.of(context).pop(locale),
                        ),
                      const SizedBox(height: 8),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
    if (selected != null) {
      await controller.setLocale(selected);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;
    final theme = ThemeScope.of(context);
    final path = library.storagePath ?? '—';
    final media = MediaQuery.of(context);
    final topInset =
        media.padding.top > 0 ? media.padding.top : media.viewPadding.top;
    final bottomInset =
        media.padding.bottom > 0
            ? media.padding.bottom
            : media.viewPadding.bottom;
    final currentTheme = theme.colorThemeId;

    return DismissibleSheetScaffold(
      sheet: DraggableScrollableSheet(
        controller: _sheetController,
        expand: false,
        initialChildSize: _settingsPreviewSize,
        minChildSize: _settingsPreviewSize,
        maxChildSize: _settingsFullSize,
        snap: true,
        snapSizes: const [_settingsPreviewSize, _settingsFullSize],
        builder: (context, scrollController) {
          return AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius:
                  _isFull
                      ? BorderRadius.zero
                      : const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              children: [
                SheetDragArea(
                  controller: _sheetController,
                  minChildSize: _settingsPreviewSize,
                  maxChildSize: _settingsFullSize,
                  snapSizes: const [_settingsPreviewSize, _settingsFullSize],
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
                        padding: const EdgeInsets.fromLTRB(16, 10, 8, 4),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                s.settingsCenter,
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
                              icon: Icon(
                                LucideIcons.x,
                                size: 18,
                                color: colors.muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Divider(height: 1, color: colors.border),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    controller: scrollController,
                    padding: EdgeInsets.fromLTRB(12, 10, 12, 20 + bottomInset),
                    children: [
                      _SectionCard(
                        title: s.appearance,
                        child: Column(
                          children: [
                            _CompactTile(
                              leading: Icon(
                                LucideIcons.languages,
                                size: 18,
                                color: colors.accent,
                              ),
                              title: s.displayLanguage,
                              subtitle: s.displayLanguageDesc,
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    context.l10n.locale.nativeLabel,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: colors.body,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  Icon(
                                    LucideIcons.chevronRight,
                                    size: 16,
                                    color: colors.muted,
                                  ),
                                ],
                              ),
                              onTap: _pickLocale,
                            ),
                            Divider(height: 1, color: colors.border),
                            _CompactTile(
                              leading: Icon(
                                LucideIcons.palette,
                                size: 18,
                                color: colors.accent,
                              ),
                              title: s.colorTheme,
                              subtitle: currentTheme.descriptionFor(s),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    currentTheme.labelFor(s),
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: colors.body,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  Icon(
                                    LucideIcons.chevronRight,
                                    size: 16,
                                    color: colors.muted,
                                  ),
                                ],
                              ),
                              onTap: () => _pickColorTheme(theme),
                            ),
                            Divider(height: 1, color: colors.border),
                            _CompactTile(
                              leading: Icon(
                                theme.isDark
                                    ? LucideIcons.moon
                                    : LucideIcons.sun,
                                size: 18,
                                color: colors.accent,
                              ),
                              title: s.darkMode,
                              subtitle: s.darkModeDesc,
                              trailing: Switch.adaptive(
                                value: theme.isDark,
                                activeTrackColor: colors.accent,
                                onChanged: (value) => theme.setDark(value),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      _SectionCard(
                        title: s.sync,
                        child: Column(
                          children: [
                            _CompactTile(
                              leading: Icon(
                                LucideIcons.cloud,
                                size: 18,
                                color:
                                    library.iCloudEnabled
                                        ? colors.accent
                                        : colors.muted,
                              ),
                              title: s.iCloudDriveSync,
                              subtitle:
                                  !library.iCloudSupported
                                      ? s.iCloudSyncUnsupported
                                      : library.iCloudEnabled
                                      ? s.iCloudSyncBound
                                      : s.iCloudSyncChooseFolder,
                              trailing: Switch.adaptive(
                                value: library.iCloudEnabled,
                                activeTrackColor: colors.accent,
                                onChanged:
                                    (!library.iCloudSupported ||
                                            library.syncBusy)
                                        ? null
                                        : _toggleICloud,
                              ),
                            ),
                            if (library.iCloudEnabled) ...[
                              Divider(height: 1, color: colors.border),
                              _CompactTile(
                                leading: Icon(
                                  LucideIcons.folderInput,
                                  size: 18,
                                  color: colors.accent,
                                ),
                                title: s.reselectFolder,
                                subtitle: s.reselectFolderDesc,
                                trailing: Icon(
                                  LucideIcons.chevronRight,
                                  size: 16,
                                  color: colors.muted,
                                ),
                                onTap: library.syncBusy ? null : _changeFolder,
                              ),
                            ],
                            if (library.syncBusy) ...[
                              const SizedBox(height: 8),
                              LinearProgressIndicator(
                                minHeight: 2,
                                color: colors.accent,
                                backgroundColor: colors.accentSoft,
                              ),
                              if (library.syncMessage != null) ...[
                                const SizedBox(height: 6),
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: Text(
                                    library.syncMessage!,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: colors.body,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      _SectionCard(
                        title: s.data,
                        child: Column(
                          children: [
                            _CompactTile(
                              leading: Icon(
                                LucideIcons.folderOpen,
                                size: 18,
                                color: colors.accent,
                              ),
                              title: s.currentLibraryPath,
                              subtitleWidget: SelectableText(
                                path,
                                style: TextStyle(
                                  fontSize: 11,
                                  height: 1.3,
                                  color: colors.body,
                                ),
                              ),
                            ),
                            Divider(height: 1, color: colors.border),
                            _CompactTile(
                              leading: Icon(
                                library.iCloudEnabled
                                    ? LucideIcons.cloudCheck
                                    : LucideIcons.hardDrive,
                                size: 18,
                                color: colors.accent,
                              ),
                              title:
                                  library.iCloudEnabled
                                      ? s.storageCloudFolder
                                      : s.storageLocal,
                              subtitle:
                                  library.iCloudEnabled
                                      ? s.storageCloudDesc
                                      : s.storageLocalDesc,
                              trailing: IconButton(
                                tooltip: s.commonRefresh,
                                visualDensity: VisualDensity.compact,
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(
                                  minWidth: 32,
                                  minHeight: 32,
                                ),
                                onPressed:
                                    library.loading || library.syncBusy
                                        ? null
                                        : library.refresh,
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
                                          size: 16,
                                          color: colors.muted,
                                        ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      _SectionCard(
                        title: s.author,
                        child: Column(
                          children: [
                            _CompactTile(
                              leading: Icon(
                                LucideIcons.userRound,
                                size: 18,
                                color: colors.accent,
                              ),
                              title: s.projectAuthor,
                              subtitle: s.authorName,
                              trailing: Icon(
                                LucideIcons.externalLink,
                                size: 16,
                                color: colors.muted,
                              ),
                              onTap:
                                  () => _openExternalUrl(
                                    authorUrl,
                                    failureMessage: s.openAuthorFailed,
                                  ),
                            ),
                            Divider(height: 1, color: colors.border),
                            _CompactTile(
                              leading: Icon(
                                LucideIcons.globe,
                                size: 18,
                                color: colors.accent,
                              ),
                              title: s.authorHomepage,
                              subtitle: authorUrl,
                              trailing: Icon(
                                LucideIcons.externalLink,
                                size: 16,
                                color: colors.muted,
                              ),
                              onTap:
                                  () => _openExternalUrl(
                                    authorUrl,
                                    failureMessage: s.openAuthorFailed,
                                  ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      _SectionCard(
                        title: s.about,
                        child: Column(
                          children: [
                            _CompactTile(
                              leading: Icon(
                                LucideIcons.info,
                                size: 18,
                                color: colors.accent,
                              ),
                              title: s.appTitle,
                              subtitle: s.appDescription,
                            ),
                            Divider(height: 1, color: colors.border),
                            _CompactTile(
                              leading: Icon(
                                LucideIcons.folderGit2,
                                size: 18,
                                color: colors.accent,
                              ),
                              title: s.projectHomepage,
                              subtitle: homepageUrl,
                              trailing: Icon(
                                LucideIcons.externalLink,
                                size: 16,
                                color: colors.muted,
                              ),
                              onTap:
                                  () => _openExternalUrl(
                                    homepageUrl,
                                    failureMessage: s.openProjectFailed,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ThemeSwatch extends StatelessWidget {
  const _ThemeSwatch({required this.themeId, required this.isDark});

  final ColorThemeId themeId;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.resolve(themeId, isDark);
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: palette.background,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: palette.border),
      ),
      child: Center(
        child: Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: palette.accent,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
      ),
    );
  }
}

extension _ColorThemeL10n on ColorThemeId {
  String labelFor(AppStrings s) {
    return switch (this) {
      ColorThemeId.defaultTheme => s.themeAuroraBlueLabel,
      ColorThemeId.qinglan => s.themeTealBlueLabel,
      ColorThemeId.sunset => s.themeSakuraPinkLabel,
      ColorThemeId.paper => s.themePaperGrayLabel,
      ColorThemeId.matcha => s.themeMatchaGreenLabel,
    };
  }

  String descriptionFor(AppStrings s) {
    return switch (this) {
      ColorThemeId.defaultTheme => s.themeAuroraBlueDesc,
      ColorThemeId.qinglan => s.themeTealBlueDesc,
      ColorThemeId.sunset => s.themeSakuraPinkDesc,
      ColorThemeId.paper => s.themePaperGrayDesc,
      ColorThemeId.matcha => s.themeMatchaGreenDesc,
    };
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      color: colors.background,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: colors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: colors.muted,
                letterSpacing: 0.3,
              ),
            ),
            const SizedBox(height: 2),
            child,
          ],
        ),
      ),
    );
  }
}

class _CompactTile extends StatelessWidget {
  const _CompactTile({
    required this.leading,
    required this.title,
    this.subtitle,
    this.subtitleWidget,
    this.trailing,
    this.onTap,
  });

  final Widget leading;
  final String title;
  final String? subtitle;
  final Widget? subtitleWidget;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final body = Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        leading,
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: colors.title,
                ),
              ),
              if (subtitleWidget != null) ...[
                const SizedBox(height: 2),
                subtitleWidget!,
              ] else if (subtitle != null) ...[
                const SizedBox(height: 1),
                Text(
                  subtitle!,
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.25,
                    color: colors.body,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 4), trailing!],
      ],
    );

    if (onTap == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: body,
      );
    }

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: body,
      ),
    );
  }
}
