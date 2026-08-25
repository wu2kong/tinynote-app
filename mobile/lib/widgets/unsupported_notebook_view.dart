import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../constants/app.dart';
import '../core/path_utils.dart';
import '../core/types.dart';
import '../l10n/l10n.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';
import '../utils/open_url.dart';

class UnsupportedNotebookView extends StatelessWidget {
  const UnsupportedNotebookView({
    super.key,
    required this.library,
    required this.notebook,
  });

  final LibraryService library;
  final Notebook notebook;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;
    final suffix = unknownNotebookFormatSuffix(basename(notebook.path)) ?? '';

    Future<void> openUpgradePage() async {
      final opened = await openExternalUrl(downloadPageUrl);
      if (!opened && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(s.unsupportedFormatOpenFailed)),
        );
      }
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.circleAlert, size: 44, color: colors.accent),
            const SizedBox(height: 16),
            Text(
              s.unsupportedFormatTitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: colors.body,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              s.fill(s.unsupportedFormatMessage, {'suffix': suffix}),
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, height: 1.5, color: colors.muted),
            ),
            const SizedBox(height: 24),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: colors.accent),
              onPressed: openUpgradePage,
              child: Text(s.unsupportedFormatUpgrade),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: library.openUnsupportedAsMarkdown,
              child: Text(s.unsupportedFormatOpenMarkdown),
            ),
          ],
        ),
      ),
    );
  }
}
