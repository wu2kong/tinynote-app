import { readTextFile, writeTextFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { isWeb } from '@/platform/detect';
import { basename, normalizePath } from '@/utils/path';
import type { GitRemoteAuth, LLMProviderConfig } from '@/utils/configTypes';
import { IS_MAC_APP_STORE } from '@/constants/distribution';
import { appDataDir, join } from '@tauri-apps/api/path';

const HOME_CONFIG_DIR = '.tinynotes';
const WORKSPACES_FILE = '.tinynotes/work-spaces.json';
const HOME = BaseDirectory.Home;
const NATIVE_CONFIG_BASE = IS_MAC_APP_STORE ? BaseDirectory.AppData : HOME;
const WEB_REGISTRY_KEY = 'tinynote.work-spaces.v1';

export interface WorkspaceLocalSettings {
  backupDir?: string | null;
  syncAuthToken?: string | null;
  gitRemoteAuth?: Record<string, GitRemoteAuth>;
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
    if (!(await exists(HOME_CONFIG_DIR, { baseDir: NATIVE_CONFIG_BASE }))) {
      await mkdir(HOME_CONFIG_DIR, { recursive: true, baseDir: NATIVE_CONFIG_BASE });
    }
  } catch {
    await mkdir(HOME_CONFIG_DIR, { recursive: true, baseDir: NATIVE_CONFIG_BASE });
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
    const content = await readTextFile(WORKSPACES_FILE, { baseDir: NATIVE_CONFIG_BASE });
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
    baseDir: NATIVE_CONFIG_BASE,
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

export async function unregisterWorkspace(path: string): Promise<WorkspacesRegistry> {
  const normalizedPath = normalizePath(path);
  const registry = await loadWorkspacesRegistry();
  registry.workspaces = registry.workspaces.filter(
    (item) => normalizePath(item.path) !== normalizedPath,
  );
  if (registry.lastActivePath && normalizePath(registry.lastActivePath) === normalizedPath) {
    registry.lastActivePath = registry.workspaces[0]?.path ?? null;
  }
  await saveWorkspacesRegistry(registry);
  return registry;
}

/** Drop recent entries except `keepPath` (typically the current workspace). */
export async function clearRecentWorkspaces(keepPath?: string | null): Promise<WorkspacesRegistry> {
  const registry = await loadWorkspacesRegistry();
  const keep = keepPath ? normalizePath(keepPath) : null;
  if (keep) {
    const kept = registry.workspaces.filter((item) => normalizePath(item.path) === keep);
    registry.workspaces = kept.length > 0
      ? kept
      : [{
          path: keep,
          label: basename(keep) || keep,
          lastOpenedAt: new Date().toISOString(),
        }];
    registry.lastActivePath = keep;
  } else {
    registry.workspaces = [];
    registry.lastActivePath = null;
  }
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
  if (IS_MAC_APP_STORE) {
    return normalizePath(await join(await appDataDir(), WORKSPACES_FILE));
  }
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
