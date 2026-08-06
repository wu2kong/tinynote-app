import 'dart:async';

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

OverlayEntry? _activeToast;
Timer? _dismissTimer;

/// Shows a short toast above modal sheets / drawers via the root [Overlay].
void showAppToast(
  BuildContext context,
  String message, {
  Duration duration = const Duration(milliseconds: 1400),
}) {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) {
    ScaffoldMessenger.maybeOf(context)
      ?..clearSnackBars()
      ..showSnackBar(
        SnackBar(content: Text(message), duration: duration),
      );
    return;
  }

  final colors = context.colors;
  final isDark = Theme.of(context).brightness == Brightness.dark;
  final background = isDark ? colors.hover : colors.title;
  final foreground = isDark ? colors.title : Colors.white;
  final bottomInset = MediaQuery.viewPaddingOf(context).bottom;

  _dismissTimer?.cancel();
  _activeToast?.remove();
  _activeToast = null;

  late final OverlayEntry entry;
  entry = OverlayEntry(
    builder: (context) {
      return IgnorePointer(
        child: _AppToastBanner(
          message: message,
          background: background,
          foreground: foreground,
          bottomInset: bottomInset,
        ),
      );
    },
  );

  _activeToast = entry;
  overlay.insert(entry);
  _dismissTimer = Timer(duration, () {
    if (_activeToast == entry) {
      entry.remove();
      _activeToast = null;
    }
  });
}

class _AppToastBanner extends StatelessWidget {
  const _AppToastBanner({
    required this.message,
    required this.background,
    required this.foreground,
    required this.bottomInset,
  });

  final String message;
  final Color background;
  final Color foreground;
  final double bottomInset;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.bottomCenter,
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 28 + bottomInset),
        child: Material(
          color: Colors.transparent,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.18),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: foreground,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  height: 1.3,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
