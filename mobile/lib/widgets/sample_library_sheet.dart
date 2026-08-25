import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../l10n/l10n.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';
import 'app_toast.dart';

Future<void> showSampleLibrarySheet({
  required BuildContext context,
  required LibraryService library,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: context.colors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (context) => _SampleLibrarySheet(library: library),
  );
}

class _SampleLibrarySheet extends StatefulWidget {
  const _SampleLibrarySheet({required this.library});

  final LibraryService library;

  @override
  State<_SampleLibrarySheet> createState() => _SampleLibrarySheetState();
}

class _SampleLibrarySheetState extends State<_SampleLibrarySheet> {
  late AppLocale _targetLanguage;
  var _localeReady = false;
  var _busy = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_localeReady) return;
    _targetLanguage = context.l10n.locale;
    _localeReady = true;
  }

  Future<void> _import() async {
    if (_busy) return;
    final s = context.s;
    setState(() => _busy = true);
    try {
      final result = await widget.library.importOfficialSampleLibrary(
        _targetLanguage,
      );
      if (!mounted) return;
      showAppToast(
        context,
        s.fill(s.sampleLibraryImported, {
          'name': result.spaceName,
          'count': '${result.noteCount}',
        }),
      );
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      showAppToast(context, s.sampleLibraryImportFailed);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final maxHeight = MediaQuery.sizeOf(context).height * 0.86;

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, 10, 16, 16 + bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 16),
              Icon(LucideIcons.sparkles, size: 28, color: colors.accent),
              const SizedBox(height: 10),
              Text(
                s.sampleLibraryTitle,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: colors.title,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                s.sampleLibraryDescription,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, height: 1.4, color: colors.body),
              ),
              const SizedBox(height: 14),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    _FormatRow(
                      icon: LucideIcons.boxes,
                      title: s.sampleLibraryBlocksTitle,
                      desc: s.sampleLibraryBlocksDesc,
                    ),
                    _FormatRow(
                      icon: LucideIcons.fileCode,
                      title: s.sampleLibraryMarkdownTitle,
                      desc: s.sampleLibraryMarkdownDesc,
                    ),
                    _FormatRow(
                      icon: LucideIcons.penLine,
                      title: s.sampleLibraryWriterTitle,
                      desc: s.sampleLibraryWriterDesc,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          LucideIcons.bookOpen,
                          size: 14,
                          color: colors.muted,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            s.sampleLibrarySafeImportNote,
                            style: TextStyle(
                              fontSize: 12,
                              height: 1.35,
                              color: colors.body,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      s.sampleLibraryContentLanguage,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: colors.muted,
                      ),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<AppLocale>(
                      initialValue: _targetLanguage,
                      isExpanded: true,
                      decoration: InputDecoration(
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      items: [
                        for (final locale in AppLocale.values)
                          DropdownMenuItem(
                            value: locale,
                            child: Text(locale.nativeLabel),
                          ),
                      ],
                      onChanged:
                          _busy
                              ? null
                              : (value) {
                                if (value == null) return;
                                setState(() => _targetLanguage = value);
                              },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              if (_busy) ...[
                LinearProgressIndicator(
                  minHeight: 2,
                  color: colors.accent,
                  backgroundColor: colors.accentSoft,
                ),
                const SizedBox(height: 12),
              ],
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _busy ? null : () => Navigator.of(context).pop(),
                      child: Text(s.sampleLibraryNotNow),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _busy ? null : _import,
                      icon: Icon(
                        _busy ? LucideIcons.loaderCircle : LucideIcons.sparkles,
                        size: 16,
                      ),
                      label: Text(
                        _busy
                            ? s.sampleLibraryImporting
                            : s.sampleLibraryImportAction,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FormatRow extends StatelessWidget {
  const _FormatRow({
    required this.icon,
    required this.title,
    required this.desc,
  });

  final IconData icon;
  final String title;
  final String desc;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: colors.accent),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: colors.title,
                  ),
                ),
                Text(
                  desc,
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.3,
                    color: colors.body,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
