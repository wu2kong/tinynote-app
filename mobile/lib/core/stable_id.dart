String stableIdFromParts(List<String> parts) {
  final input = parts.where((part) => part.isNotEmpty).join('\u0000');
  var hash = 2166136261;
  for (var i = 0; i < input.length; i++) {
    hash ^= input.codeUnitAt(i);
    hash = (hash * 16777619) & 0xFFFFFFFF;
  }
  final hex = hash.toRadixString(16).padLeft(8, '0');
  return 'tn_$hex';
}

String stableIdFromPath(String path) => stableIdFromParts([path]);

String stableNoteBlockId(String notebookPath, int index, String createdAt) {
  return stableIdFromParts([notebookPath, index.toString(), createdAt]);
}
