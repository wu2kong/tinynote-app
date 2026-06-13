/** Normalize separators so path comparisons work across macOS and Windows. */
export function normalizePath(p: string): string {
  let normalized = p.replace(/\\/g, '/').replace(/\/+/g, '/');
  // Repair macOS legacy paths where joinPath dropped the leading slash (/Users/... → Users/...).
  // Windows absolute paths always include a drive letter (C:/...) and are excluded by the check below.
  if (
    normalized.length > 0 &&
    !normalized.startsWith('/') &&
    !/^[A-Za-z]:/.test(normalized) &&
    (/^Users\//.test(normalized) || /^private\//.test(normalized))
  ) {
    normalized = `/${normalized}`;
  }
  return normalized;
}

export function joinPath(...segments: string[]): string {
  if (segments.length === 0) return '';

  const first = segments[0].replace(/\\/g, '/');
  // macOS/Linux absolute paths start with /. Windows uses C:/ (handled below) or UNC // (not prefixed).
  const isUnixAbsolute = first.startsWith('/') && !first.startsWith('//');

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

  // Windows: C:/Users/... — drive letter must stay on the first segment.
  if (/^[A-Za-z]:$/.test(parts[0]) && parts.length > 1) {
    return `${parts[0]}/${parts.slice(1).join('/')}`;
  }

  const joined = parts.join('/');
  return isUnixAbsolute ? `/${joined}` : joined;
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
