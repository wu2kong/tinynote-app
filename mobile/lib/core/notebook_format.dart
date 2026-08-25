enum NotebookFormat { blocks, markdown, writer }

class NotebookFormatDef {
  const NotebookFormatDef({
    required this.id,
    required this.extension,
    this.aliases = const [],
  });

  final NotebookFormat id;
  final String extension;
  final List<String> aliases;
}

/// Notebook formats keyed by filename suffix.
/// Longer / more specific suffixes are matched first.
const notebookFormats = <NotebookFormatDef>[
  NotebookFormatDef(
    id: NotebookFormat.blocks,
    extension: '.blk.md',
    aliases: ['.md'],
  ),
  NotebookFormatDef(id: NotebookFormat.markdown, extension: '.mk.md'),
  NotebookFormatDef(id: NotebookFormat.writer, extension: '.writer.md'),
];

class _SuffixMatcher {
  const _SuffixMatcher(this.format, this.suffix);
  final NotebookFormat format;
  final String suffix;
}

final _formatById = {for (final format in notebookFormats) format.id: format};

/// All known suffixes sorted longest-first for unambiguous matching.
final _suffixMatchers = () {
  final matchers = <_SuffixMatcher>[
    for (final format in notebookFormats) ...[
      _SuffixMatcher(format.id, format.extension),
      ...format.aliases.map((suffix) => _SuffixMatcher(format.id, suffix)),
    ],
  ]..sort((a, b) => b.suffix.length.compareTo(a.suffix.length));
  return List<_SuffixMatcher>.unmodifiable(matchers);
}();

extension NotebookFormatX on NotebookFormat {
  bool get isDocument => this != NotebookFormat.blocks;

  String get extension => (_formatById[this] ?? _formatById[NotebookFormat.blocks]!).extension;

  NotebookFormat? get swappableArticleFormat {
    if (this == NotebookFormat.markdown) return NotebookFormat.writer;
    if (this == NotebookFormat.writer) return NotebookFormat.markdown;
    return null;
  }
}

NotebookFormatDef getFormatDef(NotebookFormat format) {
  return _formatById[format] ?? _formatById[NotebookFormat.blocks]!;
}

String getFormatExtension(NotebookFormat format) => getFormatDef(format).extension;

String? matchedNotebookSuffix(String fileName) {
  final lower = fileName.toLowerCase();
  for (final matcher in _suffixMatchers) {
    if (lower.endsWith(matcher.suffix)) {
      return fileName.substring(fileName.length - matcher.suffix.length);
    }
  }
  return null;
}

NotebookFormat detectNotebookFormat(String fileName) {
  final lower = fileName.toLowerCase();
  for (final matcher in _suffixMatchers) {
    if (lower.endsWith(matcher.suffix)) return matcher.format;
  }
  return NotebookFormat.blocks;
}

String notebookDisplayName(String fileName) {
  final suffix = matchedNotebookSuffix(fileName);
  if (suffix != null) {
    return fileName.substring(0, fileName.length - suffix.length);
  }
  return fileName.replaceAll(RegExp(r'\.md$', caseSensitive: false), '');
}

String replaceNotebookFormatSuffix(String fileName, NotebookFormat targetFormat) {
  return buildNotebookFileName(notebookDisplayName(fileName), targetFormat);
}

class ResolvedNotebookFileName {
  const ResolvedNotebookFileName({
    required this.fileName,
    required this.format,
    required this.displayName,
  });

  final String fileName;
  final NotebookFormat format;
  final String displayName;
}

/// Resolve a user-entered notebook name into a concrete filename + format.
ResolvedNotebookFileName resolveNotebookFileName(
  String inputName, {
  NotebookFormat preferredFormat = NotebookFormat.blocks,
  String? preserveExtension,
}) {
  final trimmed = inputName.trim();
  final preserved = preserveExtension == null
      ? null
      : _normalizePreserveExtension(preserveExtension, preferredFormat);

  if (trimmed.isEmpty) {
    final extension = preserved ?? getFormatExtension(preferredFormat);
    return ResolvedNotebookFileName(
      fileName: 'untitled$extension',
      format: preferredFormat,
      displayName: 'untitled',
    );
  }

  if (RegExp(r'\.md$', caseSensitive: false).hasMatch(trimmed)) {
    final format = detectNotebookFormat(trimmed);
    return ResolvedNotebookFileName(
      fileName: trimmed,
      format: format,
      displayName: notebookDisplayName(trimmed),
    );
  }

  for (final matcher in _suffixMatchers) {
    final stem = matcher.suffix.replaceAll(RegExp(r'\.md$', caseSensitive: false), '');
    if (stem.isEmpty || stem == '.') continue;
    if (trimmed.toLowerCase().endsWith(stem)) {
      final displayName = trimmed.substring(0, trimmed.length - stem.length);
      return ResolvedNotebookFileName(
        fileName: '$trimmed.md',
        format: matcher.format,
        displayName: displayName.isEmpty ? trimmed : displayName,
      );
    }
  }

  final extension = preserved ?? getFormatExtension(preferredFormat);
  return ResolvedNotebookFileName(
    fileName: '$trimmed$extension',
    format: preferredFormat,
    displayName: trimmed,
  );
}

String _normalizePreserveExtension(String extension, NotebookFormat preferredFormat) {
  final normalized = extension.startsWith('.') ? extension : '.$extension';
  final lower = normalized.toLowerCase();
  for (final matcher in _suffixMatchers) {
    if (matcher.suffix == lower && matcher.format == preferredFormat) {
      return normalized;
    }
  }
  return getFormatExtension(preferredFormat);
}

String buildNotebookFileName(String displayName, NotebookFormat format) {
  return resolveNotebookFileName(displayName, preferredFormat: format).fileName;
}

String initialNotebookContent(NotebookFormat format, String displayName) {
  if (format.isDocument) {
    return '# $displayName\n\n';
  }
  final now = DateTime.now().toUtc().toIso8601String();
  return '---\n'
      'title: $displayName\n'
      'tags: []\n'
      'createdAt: $now\n'
      'updatedAt: $now\n'
      '---\n\n';
}

class NotebookExistsException implements Exception {
  const NotebookExistsException(this.name);
  final String name;
}

class NotebookFormatNotSwappableException implements Exception {
  const NotebookFormatNotSwappableException();
}
