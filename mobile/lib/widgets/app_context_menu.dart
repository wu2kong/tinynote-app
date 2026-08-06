import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

class AppContextMenuItem<T> {
  const AppContextMenuItem({
    required this.value,
    required this.label,
    this.icon,
    this.danger = false,
  });

  final T value;
  final String label;
  final IconData? icon;
  final bool danger;
}

/// Floating popup menu near [globalPosition], or anchored to [context]'s widget.
///
/// Uses the root navigator so the menu stays above modal bottom sheets.
Future<T?> showAppContextMenu<T>({
  required BuildContext context,
  required List<AppContextMenuItem<T>> items,
  Offset? globalPosition,
}) {
  if (items.isEmpty) return Future<T?>.value(null);

  final colors = context.colors;
  final position = _resolveMenuPosition(context, globalPosition);

  return showMenu<T>(
    context: context,
    useRootNavigator: true,
    position: position,
    color: colors.surface,
    surfaceTintColor: Colors.transparent,
    shadowColor: Colors.black.withValues(alpha: 0.18),
    elevation: 10,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: BorderSide(color: colors.border),
    ),
    constraints: const BoxConstraints(minWidth: 168, maxWidth: 260),
    items: [
      for (final item in items)
        PopupMenuItem<T>(
          value: item.value,
          height: 44,
          child: Row(
            children: [
              if (item.icon != null) ...[
                Icon(
                  item.icon,
                  size: 18,
                  color: item.danger ? colors.danger : colors.body,
                ),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Text(
                  item.label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: item.danger ? colors.danger : colors.title,
                  ),
                ),
              ),
            ],
          ),
        ),
    ],
  );
}

RelativeRect _resolveMenuPosition(BuildContext context, Offset? globalPosition) {
  final overlay = Navigator.of(context, rootNavigator: true)
      .overlay
      ?.context
      .findRenderObject() as RenderBox?;
  final overlaySize = overlay?.size ?? MediaQuery.sizeOf(context);

  if (globalPosition != null) {
    return RelativeRect.fromRect(
      Rect.fromLTWH(globalPosition.dx, globalPosition.dy, 0, 0),
      Offset.zero & overlaySize,
    );
  }

  final box = context.findRenderObject() as RenderBox?;
  if (box != null && box.hasSize && box.attached) {
    final origin = box.localToGlobal(Offset.zero);
    final rect = Rect.fromLTWH(origin.dx, origin.dy, box.size.width, box.size.height);
    return RelativeRect.fromRect(rect, Offset.zero & overlaySize);
  }

  return RelativeRect.fromLTRB(
    overlaySize.width * 0.28,
    overlaySize.height * 0.32,
    overlaySize.width * 0.28,
    overlaySize.height * 0.32,
  );
}
