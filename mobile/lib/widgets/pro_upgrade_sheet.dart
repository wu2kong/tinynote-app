import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../constants/pro.dart';
import '../core/types.dart';
import '../l10n/l10n.dart';
import '../services/library_service.dart';
import '../services/license_store.dart';
import '../theme/app_colors.dart';
import 'app_store_purchase_controls.dart';
import 'app_toast.dart';
import 'sheet_drag_area.dart';

Future<void> showProUpgradeSheet({
  required BuildContext context,
  required LibraryService library,
  ProFeature feature = ProFeature.articleNotebook,
  GateContext? gateContext,
}) {
  final license = LicenseScope.maybeOf(context);
  license?.openGate(feature, context: gateContext);

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.35),
    builder:
        (context) => ProUpgradeSheet(
          library: library,
          feature: feature,
          gateContext: gateContext,
        ),
  ).whenComplete(() {
    license?.closeGate();
  });
}

class ProUpgradeSheet extends StatefulWidget {
  const ProUpgradeSheet({
    super.key,
    required this.library,
    required this.feature,
    this.gateContext,
  });

  final LibraryService library;
  final ProFeature feature;
  final GateContext? gateContext;

  @override
  State<ProUpgradeSheet> createState() => _ProUpgradeSheetState();
}

class _ProUpgradeSheetState extends State<ProUpgradeSheet> {
  var _creatingSample = false;

  LibraryService get library => widget.library;

  NotebookFormat get _sampleFormat =>
      widget.gateContext?.format ?? NotebookFormat.markdown;

  Notebook? get _existingSample {
    final space = library.currentSpace;
    if (space == null || widget.feature != ProFeature.articleNotebook) {
      return null;
    }
    final found = collectSpaceArticleNotebooks(space, format: _sampleFormat);
    return found.isEmpty ? null : found.first;
  }

  bool get _canCreateSample {
    if (widget.feature != ProFeature.articleNotebook) return false;
    if (_existingSample != null) return false;
    final parent = widget.gateContext?.parentPath ?? library.currentSpace?.path;
    return parent != null && parent.isNotEmpty;
  }

  String _featureMessage(AppStrings s) {
    return switch (widget.feature) {
      ProFeature.spaceLimit => s.proGateSpaceLimit,
      ProFeature.notebookLimit => s.proGateNotebookLimit,
      ProFeature.articleNotebook => s.proGateArticleNotebook,
      ProFeature.sync => s.proGateSync,
    };
  }

  Future<void> _createSample() async {
    if (_creatingSample || !_canCreateSample) return;
    final parent = widget.gateContext?.parentPath ?? library.currentSpace?.path;
    if (parent == null) return;
    final s = context.s;
    final name =
        _sampleFormat == NotebookFormat.writer
            ? s.proTrialSampleWriterName
            : s.proTrialSampleMarkdownName;
    setState(() => _creatingSample = true);
    try {
      await library.createNotebook(parent, name, format: _sampleFormat);
      if (!mounted) return;
      showAppToast(
        context,
        s.fill(s.proTrialSampleCreated, {'name': name}),
      );
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      showAppToast(context, '$error');
    } finally {
      if (mounted) setState(() => _creatingSample = false);
    }
  }

  Future<void> _openSample() async {
    final sample = _existingSample;
    if (sample == null) return;
    await library.selectNotebook(sample);
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;
    final media = MediaQuery.of(context);
    final bottomInset =
        media.padding.bottom > 0 ? media.padding.bottom : media.viewPadding.bottom;
    final existing = _existingSample;

    return DismissibleSheetScaffold(
      sheet: Align(
        alignment: Alignment.bottomCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: media.size.height * 0.92,
            maxWidth: 560,
          ),
          child: Material(
            color: colors.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            clipBehavior: Clip.antiAlias,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Column(
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
                      padding: const EdgeInsets.fromLTRB(16, 10, 8, 4),
                      child: Row(
                        children: [
                          Icon(
                            LucideIcons.crown,
                            size: 18,
                            color: colors.accent,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              s.proGateTitle,
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
                Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    padding: EdgeInsets.fromLTRB(16, 14, 16, 20 + bottomInset),
                    children: [
                      Text(
                        _featureMessage(s),
                        style: TextStyle(
                          fontSize: 14,
                          height: 1.45,
                          color: colors.body,
                        ),
                      ),
                      if (widget.feature == ProFeature.articleNotebook) ...[
                        const SizedBox(height: 8),
                        Text(
                          existing == null
                              ? s.proTrialArticleHint
                              : s.fill(s.proTrialArticleExists, {
                                'name': existing.name,
                              }),
                          style: TextStyle(
                            fontSize: 13,
                            height: 1.4,
                            color: colors.muted,
                          ),
                        ),
                        if (_canCreateSample || existing != null) ...[
                          const SizedBox(height: 10),
                          if (_canCreateSample)
                            OutlinedButton.icon(
                              onPressed:
                                  _creatingSample ? null : _createSample,
                              icon:
                                  _creatingSample
                                      ? const SizedBox(
                                        width: 14,
                                        height: 14,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      )
                                      : const Icon(
                                        LucideIcons.filePlus,
                                        size: 16,
                                      ),
                              label: Text(s.proTrialCreateSample),
                            ),
                          if (existing != null)
                            OutlinedButton.icon(
                              onPressed: _openSample,
                              icon: const Icon(LucideIcons.folderOpen, size: 16),
                              label: Text(s.proTrialOpenSample),
                            ),
                        ],
                      ],
                      const SizedBox(height: 16),
                      const AppStorePurchaseControls(),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
