import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/import_notes.dart';
import '../core/notebook_format.dart';
import '../core/path_utils.dart';
import '../l10n/l10n.dart';
import '../services/icloud_service.dart';
import '../services/library_service.dart';
import '../theme/app_colors.dart';
import 'app_toast.dart';

Future<void> showImportNotesSheet({
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
    builder: (context) => _ImportNotesSheet(library: library),
  );
}

class _ImportNotesSheet extends StatefulWidget {
  const _ImportNotesSheet({required this.library});

  final LibraryService library;

  @override
  State<_ImportNotesSheet> createState() => _ImportNotesSheetState();
}

class _ImportNotesSheetState extends State<_ImportNotesSheet> {
  var _busy = false;

  Future<void> _import(List<ImportNoteSource> sources) async {
    final s = context.s;
    if (widget.library.currentSpace == null) {
      showAppToast(context, s.importNotesNoSpace);
      return;
    }
    if (sources.isEmpty) {
      showAppToast(context, s.importNotesNoMarkdown);
      return;
    }

    setState(() => _busy = true);
    try {
      final result = await widget.library.importNotesToCurrentSpace(sources);
      if (!mounted) return;
      if (result.imported == 0) {
        showAppToast(context, s.importNotesNoMarkdown);
        return;
      }
      showAppToast(
        context,
        s.fill(s.importNotesCompleted, {
          'imported': '${result.imported}',
          'converted': '${result.converted}',
        }),
      );
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      showAppToast(context, '${s.importNotesFailed}: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickFiles() async {
    if (_busy) return;
    // iOS document picker filters by UTI, not file extension. `.md` files are
    // often tagged as plain text / data, so a custom "md" filter greys them out.
    // Allow any file, then keep only Markdown in Dart.
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.any,
      allowMultiple: true,
      withData: true,
    );
    if (!mounted || picked == null) return;

    final sources = <ImportNoteSource>[];
    for (final file in picked.files) {
      final name = basename(file.name);
      if (!isMarkdownNotebookFileName(name) || name.startsWith('.')) continue;
      final bytes = file.bytes;
      if (bytes != null) {
        final content = utf8.decode(bytes, allowMalformed: true);
        sources.add(
          ImportNoteSource(relativePath: name, readText: () async => content),
        );
        continue;
      }
      final path = file.path;
      if (path == null || path.isEmpty) continue;
      sources.add(
        ImportNoteSource(
          relativePath: name,
          sourcePath: path,
          readText: () => File(path).readAsString(),
        ),
      );
    }
    await _import(sources);
  }

  Future<void> _pickDirectory() async {
    if (_busy) return;
    try {
      final dir =
          ICloudService.isSupported
              ? await ICloudService.pickImportFolder()
              : await FilePicker.platform.getDirectoryPath();
      if (!mounted || dir == null || dir.isEmpty) return;
      await _import(await collectSourcesFromDirectory(dir));
    } catch (error) {
      if (!mounted) return;
      showAppToast(context, '${context.s.importNotesFailed}: $error');
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;
    final bottom = MediaQuery.paddingOf(context).bottom;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 10, 16, 16 + bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              s.importNotes,
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: colors.title,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              s.importNotesDesc,
              style: TextStyle(fontSize: 13, height: 1.4, color: colors.body),
            ),
            const SizedBox(height: 10),
            _Rule(text: s.importNotesRuleMarkdownOnly),
            _Rule(text: s.importNotesRuleFormats),
            _Rule(text: s.importNotesRuleUnmarked),
            _Rule(text: s.importNotesRuleTarget),
            _Rule(text: s.importNotesRuleMultiple),
            const SizedBox(height: 16),
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
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : _pickFiles,
                    icon: const Icon(LucideIcons.fileText, size: 16),
                    label: Text(s.importNotesFiles),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _busy ? null : _pickDirectory,
                    icon: const Icon(LucideIcons.folderInput, size: 16),
                    label: Text(s.importNotesDirectories),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Rule extends StatelessWidget {
  const _Rule({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Icon(LucideIcons.dot, size: 12, color: colors.accent),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              text,
              style: TextStyle(fontSize: 12, height: 1.35, color: colors.body),
            ),
          ),
        ],
      ),
    );
  }
}
