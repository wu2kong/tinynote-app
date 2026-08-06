import 'package:flutter/material.dart';

/// Wraps a bottom [DraggableScrollableSheet] so taps on the dimmed area above
/// dismiss the modal. Use with `expand: false` on the sheet.
class DismissibleSheetScaffold extends StatelessWidget {
  const DismissibleSheetScaffold({super.key, required this.sheet});

  final Widget sheet;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => Navigator.of(context).maybePop(),
        ),
        Align(
          alignment: Alignment.bottomCenter,
          child: sheet,
        ),
      ],
    );
  }
}

/// Makes a non-scrollable sheet header (handle / title bar) able to resize a
/// [DraggableScrollableSheet]. Only the sheet's [ScrollController] list can do
/// that by default, so headers outside the list feel stuck.
class SheetDragArea extends StatelessWidget {
  const SheetDragArea({
    super.key,
    required this.controller,
    required this.minChildSize,
    required this.maxChildSize,
    required this.snapSizes,
    required this.child,
  });

  final DraggableScrollableController controller;
  final double minChildSize;
  final double maxChildSize;
  final List<double> snapSizes;
  final Widget child;

  void _dragUpdate(DragUpdateDetails details, double screenHeight) {
    if (!controller.isAttached || screenHeight <= 0) return;
    final next = (controller.size - details.delta.dy / screenHeight)
        .clamp(minChildSize, maxChildSize);
    controller.jumpTo(next);
  }

  Future<void> _dragEnd(DragEndDetails details, double screenHeight) async {
    if (!controller.isAttached) return;

    final size = controller.size;
    final vy = details.velocity.pixelsPerSecond.dy;
    final sizes = {...snapSizes, minChildSize, maxChildSize}.toList()..sort();

    late final double target;
    if (vy < -280) {
      target = sizes.firstWhere((s) => s > size + 0.02, orElse: () => maxChildSize);
    } else if (vy > 280) {
      target = sizes.lastWhere((s) => s < size - 0.02, orElse: () => minChildSize);
    } else {
      target = sizes.reduce(
        (a, b) => (a - size).abs() <= (b - size).abs() ? a : b,
      );
    }

    await controller.animateTo(
      target.clamp(minChildSize, maxChildSize),
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.sizeOf(context).height;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onVerticalDragUpdate: (details) => _dragUpdate(details, screenHeight),
      onVerticalDragEnd: (details) => _dragEnd(details, screenHeight),
      child: child,
    );
  }
}
