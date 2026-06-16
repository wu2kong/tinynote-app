/** Deterministic id from path segments — stable across reloads and sync. */
export function stableIdFromParts(...parts: string[]): string {
  const input = parts.filter(Boolean).join('\0');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `tn_${hex}`;
}

export function stableIdFromPath(path: string): string {
  return stableIdFromParts(path);
}

export function stableNoteBlockId(notebookPath: string, index: number, createdAt: string): string {
  return stableIdFromParts(notebookPath, String(index), createdAt);
}
