String normalizePath(String path) {
  var normalized = path.replaceAll('\\', '/').replaceAll(RegExp(r'/+'), '/');
  if (normalized.isNotEmpty &&
      !normalized.startsWith('/') &&
      !RegExp(r'^[A-Za-z]:').hasMatch(normalized) &&
      (normalized.startsWith('Users/') || normalized.startsWith('private/'))) {
    normalized = '/$normalized';
  }
  return normalized;
}

String joinPath(String part1, [String? part2, String? part3, String? part4]) {
  final segments = [
    part1,
    part2,
    part3,
    part4,
  ].whereType<String>().where((s) => s.isNotEmpty);
  if (segments.isEmpty) return '';

  final first = segments.first.replaceAll('\\', '/');
  final isUnixAbsolute = first.startsWith('/') && !first.startsWith('//');

  final parts = <String>[];
  for (var i = 0; i < segments.length; i++) {
    final normalized = segments.elementAt(i).replaceAll('\\', '/');
    if (i == 0) {
      parts.addAll(
        normalized.split('/').where((part) {
          return part.isNotEmpty;
        }),
      );
    } else {
      parts.addAll(
        normalized
            .replaceAll(RegExp(r'^/+|/+$'), '')
            .split('/')
            .where((part) => part.isNotEmpty),
      );
    }
  }

  if (parts.isEmpty) return '';
  final joined = parts.join('/');
  return isUnixAbsolute ? '/$joined' : joined;
}

String basename(String filePath) {
  final normalized = normalizePath(filePath);
  final idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.substring(idx + 1) : normalized;
}

String dirname(String filePath) {
  final normalized = normalizePath(filePath);
  final idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.substring(0, idx) : '';
}

bool isSubPath(String parentPath, String childPath) {
  final parent = normalizePath(parentPath);
  final child = normalizePath(childPath);
  return child == parent || child.startsWith('$parent/');
}
