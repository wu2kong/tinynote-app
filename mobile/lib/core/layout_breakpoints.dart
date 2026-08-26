import 'package:flutter/widgets.dart';

/// Permanent library sidebar (iPad portrait and wider).
const double kSidebarBreakpoint = 768;

/// Note list + detail side-by-side (iPad landscape / large tablets).
const double kSplitDetailBreakpoint = 1000;

const double kSidebarWidth = 288;
const double kNotesListPaneWidth = 360;

bool isWideLayout(BuildContext context) {
  return MediaQuery.sizeOf(context).width >= kSidebarBreakpoint;
}

bool isSplitDetailLayout(BuildContext context) {
  return MediaQuery.sizeOf(context).width >= kSplitDetailBreakpoint;
}
