import { readTextFile, writeTextFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { isWeb } from '@/platform/detect';
import { basename, normalizePath } from '@/utils/path';
import type { LLMProviderConfig } from '@/utils/configTypes';

const HOME_CONFIG_DIR = '.tinynotes';
const WORKSPACES_FILE = '.tinynotes/work-spaces.json';
const HOME = BaseDirectory.Home;
const WEB_REGISTRY_KEY = 'tinynote.work-spaces.v1';

export interface WorkspaceLocalSettings {
  backupDir?: string | null;
  syncAuthToken?: string | null;
  llmProviders?: LLMProviderConfig[];
}

export interface WorkspaceEntry {
  path: string;
  label?: string;
  lastOpenedAt: string;
  local?: WorkspaceLocalSettings;
}

export interface WorkspacesRegistry {
  version: 1;
  workspaces: WorkspaceEntry[];
  lastActivePath: string | null;
}

const DEFAULT_REGISTRY: WorkspacesRegistry = {
  version: 1,
  workspaces: [],
  lastActivePath: null,
};

const SESSION_WORKSPACE_KEY = 'tinynote.sessionWorkspace';

async function ensureHomeConfigDir(): Promise<void> {
  if (isWeb()) return;
  try {
    if (!(await exists(HOME_CONFIG_DIR, { baseDir: HOME }))) {
      await mkdir(HOME_CONFIG_DIR, { recursive: true, baseDir: HOME });
    }
  } catch {
    await mkdir(HOME_CONFIG_DIR, { recursive: true, baseDir: HOME });
  }
}

export function getSessionWorkspaceOverride(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  const value = sessionStorage.getItem(SESSION_WORKSPACE_KEY);
  return value ? normalizePath(value) : null;
}

export function setSessionWorkspaceOverride(path: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  if (path) {
    sessionStorage.setItem(SESSION_WORKSPACE_KEY, normalizePath(path));
  } else {
    sessionStorage.removeItem(SESSION_WORKSPACE_KEY);
  }
}

export async function loadWorkspacesRegistry(): Promise<WorkspacesRegistry> {
  if (isWeb()) {
    try {
      const raw = localStorage.getItem(WEB_REGISTRY_KEY);
      if (!raw) return { ...DEFAULT_REGISTRY };
      const parsed = JSON.parse(raw) as WorkspacesRegistry;
      return { ...DEFAULT_REGISTRY, ...parsed, version: 1 };
    } catch {
      return { ...DEFAULT_REGISTRY };
    }
  }

  try {
    await ensureHomeConfigDir();
    const content = await readTextFile(WORKSPACES_FILE, { baseDir: HOME });
    const parsed = JSON.parse(content) as WorkspacesRegistry;
    return { ...DEFAULT_REGISTRY, ...parsed, version: 1 };
  } catch {
    return { ...DEFAULT_REGISTRY };
  }
}

export async function saveWorkspacesRegistry(registry: WorkspacesRegistry): Promise<void> {
  const payload: WorkspacesRegistry = { ...registry, version: 1 };
  if (isWeb()) {
    localStorage.setItem(WEB_REGISTRY_KEY, JSON.stringify(payload, null, 2));
    return;
  }
  await ensureHomeConfigDir();
  await writeTextFile(WORKSPACES_FILE, JSON.stringify(payload, null, 2), {
    create: true,
    baseDir: HOME,
  });
}

export async function registerWorkspace(path: string, label?: string): Promise<WorkspacesRegistry> {
  const normalizedPath = normalizePath(path);
  const registry = await loadWorkspacesRegistry();
  const now = new Date().toISOString();
  const existing = registry.workspaces.find((item) => normalizePath(item.path) === normalizedPath);

  if (existing) {
    existing.lastOpenedAt = now;
    if (label) existing.label = label;
  } else {
    registry.workspaces.push({
      path: normalizedPath,
      label: label ?? (basename(normalizedPath) || normalizedPath),
      lastOpenedAt: now,
    });
  }

  registry.lastActivePath = normalizedPath;
  registry.workspaces.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
  await saveWorkspacesRegistry(registry);
  return registry;
}

/** Workspace path passed via `?workspace=` when opening a new window. */
export function getWorkspacePathFromLaunchUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('workspace');
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed ? normalizePath(trimmed) : null;
}

export async function resolveStartupWorkspacePath(): Promise<string | null> {
  const launchPath = getWorkspacePathFromLaunchUrl();
  if (launchPath) return launchPath;

  const sessionPath = getSessionWorkspaceOverride();
  if (sessionPath) return sessionPath;

  const registry = await loadWorkspacesRegistry();
  if (registry.lastActivePath) {
    return normalizePath(registry.lastActivePath);
  }

  return null;
}

export async function getWorkspacesRegistryDisplayPath(): Promise<string> {
  if (isWeb()) return `localStorage://${WEB_REGISTRY_KEY}`;
  await ensureHomeConfigDir();
  return normalizePath(`~/${WORKSPACES_FILE}`);
}

function findWorkspaceEntry(registry: WorkspacesRegistry, path: string): WorkspaceEntry | undefined {
  const normalizedPath = normalizePath(path);
  return registry.workspaces.find((item) => normalizePath(item.path) === normalizedPath);
}

export async function loadWorkspaceLocalSettings(path: string): Promise<WorkspaceLocalSettings> {
  const registry = await loadWorkspacesRegistry();
  return findWorkspaceEntry(registry, path)?.local ?? {};
}

export async function saveWorkspaceLocalSettings(
  path: string,
  local: Partial<WorkspaceLocalSettings>,
): Promise<void> {
  const normalizedPath = normalizePath(path);
  const registry = await loadWorkspacesRegistry();
  const entry = findWorkspaceEntry(registry, normalizedPath);

  if (entry) {
    entry.local = { ...entry.local, ...local };
  } else {
    registry.workspaces.push({
      path: normalizedPath,
      label: basename(normalizedPath) || normalizedPath,
      lastOpenedAt: new Date().toISOString(),
      local: { ...local },
    });
  }

  await saveWorkspacesRegistry(registry);
}
