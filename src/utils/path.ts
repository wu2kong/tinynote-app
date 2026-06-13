/** Normalize separators so path comparisons work across macOS and Windows. */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function joinPath(...segments: string[]): string {
  const parts = segments
    .filter(Boolean)
    .flatMap((segment, index) => {
      const normalized = segment.replace(/\\/g, '/');
      if (index === 0) {
        return normalized.split('/').filter((part, i) => part.length > 0 || (i === 0 && /^[A-Za-z]:$/.test(part)));
      }
      return normalized.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    });

  if (parts.length === 0) return '';

  if (/^[A-Za-z]:$/.test(parts[0]) && parts.length > 1) {
    return `${parts[0]}/${parts.slice(1).join('/')}`;
  }

  return parts.join('/');
}

export function basename(filePath: string): string {
  const normalized = normalizePath(filePath);
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

export function dirname(filePath: string): string {
  const normalized = normalizePath(filePath);
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(0, idx) : '';
}

export function isSubPath(parentPath: string, childPath: string): boolean {
  const parent = normalizePath(parentPath);
  const child = normalizePath(childPath);
  return child === parent || child.startsWith(`${parent}/`);
}
