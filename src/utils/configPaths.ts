import type { AppConfig } from '@/utils/configTypes';
import { isSubPath, joinPath, normalizePath } from '@/utils/path';

function isNoteSpaceDirectorySegment(segment: string): boolean {
  return segment.endsWith('.tinynotes') && segment !== '.tinynotes';
}

export function isAbsoluteConfigPath(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized);
}

/** Extract portable relative path from a foreign machine's absolute path. */
export function extractPortableRelativePath(path: string): string | null {
  const normalized = normalizePath(path);
  if (!isAbsoluteConfigPath(normalized)) {
    return normalized;
  }

  const segments = normalized.split('/').filter(Boolean);
  const spaceIndex = segments.findIndex((segment) => isNoteSpaceDirectorySegment(segment));
  if (spaceIndex === -1) {
    return null;
  }

  return segments.slice(spaceIndex).join('/');
}

export function toRelativeConfigPath(workspaceRoot: string, absolutePath: string | null): string | null {
  if (absolutePath == null) {
    return null;
  }

  const root = normalizePath(workspaceRoot);
  const candidate = normalizePath(absolutePath);

  if (isSubPath(root, candidate)) {
    const relative = candidate.slice(root.length).replace(/^\//, '');
    return relative || null;
  }

  if (!isAbsoluteConfigPath(candidate)) {
    return candidate;
  }

  return extractPortableRelativePath(candidate);
}

export function toAbsoluteConfigPath(workspaceRoot: string, storedPath: string | null): string | null {
  if (storedPath == null) {
    return null;
  }

  const root = normalizePath(workspaceRoot);
  const candidate = normalizePath(storedPath);

  if (isAbsoluteConfigPath(candidate)) {
    if (isSubPath(root, candidate)) {
      return candidate;
    }
    const portable = extractPortableRelativePath(candidate);
    return portable ? joinPath(root, portable) : null;
  }

  return joinPath(root, candidate);
}

function relativizePathList(workspaceRoot: string, paths: string[]): string[] {
  return paths
    .map((path) => toRelativeConfigPath(workspaceRoot, path))
    .filter((path): path is string => path != null);
}

function absolutizePathList(workspaceRoot: string, paths: string[]): string[] {
  return paths
    .map((path) => toAbsoluteConfigPath(workspaceRoot, path))
    .filter((path): path is string => path != null);
}

export function configPathsToRelative(
  workspaceRoot: string,
  config: Partial<AppConfig>,
): Partial<AppConfig> {
  const result: Partial<AppConfig> = { ...config };

  if (result.spaceOrder) {
    result.spaceOrder = relativizePathList(workspaceRoot, result.spaceOrder);
  }

  if (result.spaceIcons) {
    const icons: Record<string, string> = {};
    for (const [key, icon] of Object.entries(result.spaceIcons)) {
      const relativeKey = toRelativeConfigPath(workspaceRoot, key);
      if (relativeKey) {
        icons[relativeKey] = icon;
      }
    }
    result.spaceIcons = icons;
  }

  if (result.groupOrder) {
    const groupOrder: Record<string, string[]> = {};
    for (const [parentPath, childPaths] of Object.entries(result.groupOrder)) {
      const relativeParent = toRelativeConfigPath(workspaceRoot, parentPath);
      if (!relativeParent) {
        continue;
      }
      groupOrder[relativeParent] = relativizePathList(workspaceRoot, childPaths);
    }
    result.groupOrder = groupOrder;
  }

  if ('currentSpacePath' in result) {
    result.currentSpacePath = toRelativeConfigPath(workspaceRoot, result.currentSpacePath ?? null);
  }
  if ('currentGroupPath' in result) {
    result.currentGroupPath = toRelativeConfigPath(workspaceRoot, result.currentGroupPath ?? null);
  }
  if ('currentNotebookPath' in result) {
    result.currentNotebookPath = toRelativeConfigPath(workspaceRoot, result.currentNotebookPath ?? null);
  }

  if (result.expandedGroupPaths) {
    result.expandedGroupPaths = relativizePathList(workspaceRoot, result.expandedGroupPaths);
  }

  return result;
}

export function configPathsToAbsolute(
  workspaceRoot: string,
  config: Partial<AppConfig>,
): Partial<AppConfig> {
  const result: Partial<AppConfig> = { ...config };

  if (result.spaceOrder) {
    result.spaceOrder = absolutizePathList(workspaceRoot, result.spaceOrder);
  }

  if (result.spaceIcons) {
    const icons: Record<string, string> = {};
    for (const [key, icon] of Object.entries(result.spaceIcons)) {
      const absoluteKey = toAbsoluteConfigPath(workspaceRoot, key);
      if (absoluteKey) {
        icons[absoluteKey] = icon;
      }
    }
    result.spaceIcons = icons;
  }

  if (result.groupOrder) {
    const groupOrder: Record<string, string[]> = {};
    for (const [parentPath, childPaths] of Object.entries(result.groupOrder)) {
      const absoluteParent = toAbsoluteConfigPath(workspaceRoot, parentPath);
      if (!absoluteParent) {
        continue;
      }
      groupOrder[absoluteParent] = absolutizePathList(workspaceRoot, childPaths);
    }
    result.groupOrder = groupOrder;
  }

  if ('currentSpacePath' in result) {
    result.currentSpacePath = toAbsoluteConfigPath(workspaceRoot, result.currentSpacePath ?? null);
  }
  if ('currentGroupPath' in result) {
    result.currentGroupPath = toAbsoluteConfigPath(workspaceRoot, result.currentGroupPath ?? null);
  }
  if ('currentNotebookPath' in result) {
    result.currentNotebookPath = toAbsoluteConfigPath(workspaceRoot, result.currentNotebookPath ?? null);
  }

  if (result.expandedGroupPaths) {
    result.expandedGroupPaths = absolutizePathList(workspaceRoot, result.expandedGroupPaths);
  }

  return result;
}
