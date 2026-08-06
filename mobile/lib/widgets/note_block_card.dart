import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/types.dart';
import '../l10n/l10n.dart';
import '../theme/app_colors.dart';
import 'app_toast.dart';

class NoteBlockCard extends StatelessWidget {
  const NoteBlockCard({
    super.key,
    required this.block,
    this.selected = false,
    this.onTap,
    this.onCopy,
  });

  final NoteBlock block;
  final bool selected;
  final VoidCallback? onTap;
  final VoidCallback? onCopy;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final s = context.s;
    final preview = block.content.trim().replaceAll(RegExp(r'\s+'), ' ');
    final previewText = preview.isEmpty ? s.commonEmptyContent : preview;

    return Material(
      color: selected ? colors.accentSoft : colors.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 10, 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? colors.accent : colors.border,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      block.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: colors.title,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      previewText,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.35,
                        color: colors.body,
                        fontFamily: 'Menlo',
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: s.commonCopyContent,
                visualDensity: VisualDensity.compact,
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: block.content));
                  onCopy?.call();
                  showAppToast(context, s.commonCopiedContent);
                },
                icon: Icon(
                  LucideIcons.copy,
                  size: 16,
                  color: selected ? colors.accent : colors.muted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
