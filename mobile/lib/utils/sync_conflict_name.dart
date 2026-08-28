import '../core/notebook_format.dart';

String formatLocalIsoDate([DateTime? date]) {
  final value = date ?? DateTime.now();
  final year = value.year.toString().padLeft(4, '0');
  final month = value.month.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  return '$year-$month-$day';
}

String withConflictCopyCount(String suffix, int n) {
  if (n <= 1) return suffix;
  if (suffix.endsWith('）')) return '${suffix.substring(0, suffix.length - 1)} $n）';
  if (suffix.endsWith(')')) return '${suffix.substring(0, suffix.length - 1)} $n)';
  return '$suffix $n';
}

({String dir, String stem, String ext}) splitRepoRelativePath(String relativePath) {
  final normalized = relativePath.replaceAll('\\', '/');
  final slash = normalized.lastIndexOf('/');
  final dir = slash >= 0 ? normalized.substring(0, slash + 1) : '';
  final base = slash >= 0 ? normalized.substring(slash + 1) : normalized;
  final suffix = matchedNotebookSuffix(base);
  if (suffix != null) {
    return (
      dir: dir,
      stem: base.substring(0, base.length - suffix.length),
      ext: suffix,
    );
  }
  final dot = base.lastIndexOf('.');
  final hasExt = dot > 0 && dot < base.length - 1;
  return (
    dir: dir,
    stem: hasExt ? base.substring(0, dot) : base,
    ext: hasExt ? base.substring(dot) : '',
  );
}

Future<String> allocateConflictCopyPath({
  required String relativePath,
  required String suffix,
  required Future<bool> Function(String path) exists,
}) async {
  final parts = splitRepoRelativePath(relativePath);
  for (var n = 1; n <= 99; n += 1) {
    final candidate =
        '${parts.dir}${parts.stem}${withConflictCopyCount(suffix, n)}${parts.ext}';
    if (!await exists(candidate)) return candidate;
  }
  throw StateError('Too many conflict copies');
}
