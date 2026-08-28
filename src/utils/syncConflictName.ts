import { getMatchedNotebookSuffix } from './notebookFormat.ts';

export function formatLocalIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function withConflictCopyCount(suffix: string, n: number): string {
  if (n <= 1) return suffix;
  if (suffix.endsWith('）')) return `${suffix.slice(0, -1)} ${n}）`;
  if (suffix.endsWith(')')) return `${suffix.slice(0, -1)} ${n})`;
  return `${suffix} ${n}`;
}

export function splitRepoRelativePath(relativePath: string): { dir: string; stem: string; ext: string } {
  const normalized = relativePath.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  const dir = slash >= 0 ? normalized.slice(0, slash + 1) : '';
  const base = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  const suffix = getMatchedNotebookSuffix(base);
  if (suffix) {
    return {
      dir,
      stem: base.slice(0, base.length - suffix.length),
      ext: suffix,
    };
  }
  const dot = base.lastIndexOf('.');
  const hasExt = dot > 0 && dot < base.length - 1;
  return {
    dir,
    stem: hasExt ? base.slice(0, dot) : base,
    ext: hasExt ? base.slice(dot) : '',
  };
}

export async function allocateConflictCopyPath(
  relativePath: string,
  suffix: string,
  exists: (path: string) => boolean | Promise<boolean>,
): Promise<string> {
  const { dir, stem, ext } = splitRepoRelativePath(relativePath);
  for (let n = 1; n <= 99; n += 1) {
    const candidate = `${dir}${stem}${withConflictCopyCount(suffix, n)}${ext}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error('Too many conflict copies');
}
