import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../services/library_service.dart';
import '../theme/app_colors.dart';
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
    useSafeArea: false,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.35),
    builder: (context) {
      return MediaQuery(
        data: MediaQuery.of(context).copyWith(
          padding: hostPadding,
          viewPadding: hostViewPadding,
        ),
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

    try {
      if (enabled) {
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('开启 iCloud / 云盘同步'),
            content: const Text(
              '请在文件选择器中选中「iCloud 云盘」里的文件夹（可新建如 TinyNote）。\n\n'
              '同一 Apple ID 的其他设备打开同一文件夹即可同步；若为空会把本机笔记复制过去。',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('取消'),
              ),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppColors.accent),
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('选择文件夹'),
              ),
            ],
          ),
        );
        if (confirmed != true || !mounted) return;
        await library.enableICloudSync();
      } else {
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('关闭同步'),
            content: const Text(
              '关闭后改用本机存储。若本机库为空，会把同步文件夹中的笔记拷回；云盘副本会保留。',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('取消'),
              ),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppColors.accent),
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('关闭同步'),
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$error')),
      );
    }
  }

  Future<void> _changeFolder() async {
    try {
      await library.changeICloudFolder();
      if (!mounted) return;
      final message = library.syncMessage;
      if (message != null && message.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final path = library.storagePath ?? '—';
    final media = MediaQuery.of(context);
    final topInset = media.padding.top > 0 ? media.padding.top : media.viewPadding.top;
    final bottomInset =
        media.padding.bottom > 0 ? media.padding.bottom : media.viewPadding.bottom;

    return DraggableScrollableSheet(
      controller: _sheetController,
      initialChildSize: _settingsPreviewSize,
      minChildSize: _settingsPreviewSize,
      maxChildSize: _settingsFullSize,
      snap: true,
      snapSizes: const [_settingsPreviewSize, _settingsFullSize],
      builder: (context, scrollController) {
        return AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: _isFull
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
                          color: const Color(0xFFD1D5DB),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 10, 8, 4),
                      child: Row(
                        children: [
                          const Expanded(
                            child: Text(
                              '设置中心',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                                color: AppColors.title,
                              ),
                            ),
                          ),
                          IconButton(
                            tooltip: '关闭',
                            visualDensity: VisualDensity.compact,
                            onPressed: () => Navigator.of(context).pop(),
                            icon: const Icon(LucideIcons.x, size: 18, color: AppColors.muted),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1, color: AppColors.border),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: EdgeInsets.fromLTRB(12, 10, 12, 20 + bottomInset),
                  children: [
                    _SectionCard(
                      title: '同步',
                      child: Column(
                        children: [
                          _CompactTile(
                            leading: Icon(
                              LucideIcons.cloud,
                              size: 18,
                              color: library.iCloudEnabled ? AppColors.accent : AppColors.muted,
                            ),
                            title: 'iCloud / 云盘同步',
                            subtitle: !library.iCloudSupported
                                ? '仅 iOS 支持'
                                : library.iCloudEnabled
                                    ? '已绑定 Files 文件夹'
                                    : '通过 Files 选择云盘文件夹',
                            trailing: Switch.adaptive(
                              value: library.iCloudEnabled,
                              activeTrackColor: AppColors.accent,
                              onChanged: (!library.iCloudSupported || library.syncBusy)
                                  ? null
                                  : _toggleICloud,
                            ),
                          ),
                          if (library.iCloudEnabled) ...[
                            const Divider(height: 1, color: AppColors.border),
                            _CompactTile(
                              leading: const Icon(
                                LucideIcons.folderInput,
                                size: 18,
                                color: AppColors.accent,
                              ),
                              title: '重新选择文件夹',
                              subtitle: '改选 iCloud 云盘中的其他目录',
                              trailing: const Icon(
                                LucideIcons.chevronRight,
                                size: 16,
                                color: AppColors.muted,
                              ),
                              onTap: library.syncBusy ? null : _changeFolder,
                            ),
                          ],
                          if (library.syncBusy) ...[
                            const SizedBox(height: 8),
                            const LinearProgressIndicator(
                              minHeight: 2,
                              color: AppColors.accent,
                              backgroundColor: AppColors.accentSoft,
                            ),
                            if (library.syncMessage != null) ...[
                              const SizedBox(height: 6),
                              Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  library.syncMessage!,
                                  style: const TextStyle(fontSize: 12, color: AppColors.body),
                                ),
                              ),
                            ],
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    _SectionCard(
                      title: '数据',
                      child: Column(
                        children: [
                          _CompactTile(
                            leading: const Icon(
                              LucideIcons.folderOpen,
                              size: 18,
                              color: AppColors.accent,
                            ),
                            title: '当前库路径',
                            subtitleWidget: SelectableText(
                              path,
                              style: const TextStyle(
                                fontSize: 11,
                                height: 1.3,
                                color: AppColors.body,
                              ),
                            ),
                          ),
                          const Divider(height: 1, color: AppColors.border),
                          _CompactTile(
                            leading: Icon(
                              library.iCloudEnabled
                                  ? LucideIcons.cloudCheck
                                  : LucideIcons.hardDrive,
                              size: 18,
                              color: AppColors.accent,
                            ),
                            title: library.iCloudEnabled ? '存储：云盘文件夹' : '存储：本机',
                            subtitle: library.iCloudEnabled
                                ? '写入所选 iCloud / Files 文件夹'
                                : '保存在本机 Documents',
                            trailing: IconButton(
                              tooltip: '刷新',
                              visualDensity: VisualDensity.compact,
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                              onPressed:
                                  library.loading || library.syncBusy ? null : library.refresh,
                              icon: library.loading
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Icon(
                                      LucideIcons.refreshCw,
                                      size: 16,
                                      color: AppColors.muted,
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    const _SectionCard(
                      title: '关于',
                      child: _CompactTile(
                        leading: Icon(LucideIcons.info, size: 18, color: AppColors.accent),
                        title: 'TinyNote 轻记',
                        subtitle: '零碎笔记整理 · 与桌面端共用 Markdown 库',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.background,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.muted,
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
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.title,
                ),
              ),
              if (subtitleWidget != null) ...[
                const SizedBox(height: 2),
                subtitleWidget!,
              ] else if (subtitle != null) ...[
                const SizedBox(height: 1),
                Text(
                  subtitle!,
                  style: const TextStyle(fontSize: 12, height: 1.25, color: AppColors.body),
                ),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: 4),
          trailing!,
        ],
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
