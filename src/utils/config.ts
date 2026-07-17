import { loadLegacyHomeConfig } from '@/adapters/config/legacyHomeConfig';
import { AppConfig, DEFAULT_CONFIG, DEFAULT_LLM_PROVIDERS, LLMProviderConfig } from '@/utils/configTypes';
import { normalizePath } from '@/utils/path';
import {
  ensureWorkspaceConfigMigrated,
  loadWorkspaceConfigFile,
  saveWorkspaceConfigFile,
} from '@/utils/workspaceConfig';
import {
  getSessionWorkspaceOverride,
  getWorkspacePathFromLaunchUrl,
  loadWorkspacesRegistry,
  loadWorkspaceLocalSettings,
  registerWorkspace,
  saveWorkspaceLocalSettings,
  setSessionWorkspaceOverride,
} from '@/utils/workspaces';

let currentWorkspacePath: string | null = null;
let configCache: AppConfig | null = null;
let bootstrappedWorkspacePath: string | null | undefined;
let bootstrapPromise: Promise<string | null> | null = null;

export function getBoundWorkspacePath(): string | null {
  return currentWorkspacePath;
}

export function getBootstrappedWorkspacePath(): string | null | undefined {
  return bootstrappedWorkspacePath;
}

export function bindWorkspace(storagePath: string | null): void {
  const normalized = storagePath ? normalizePath(storagePath) : null;
  if (currentWorkspacePath !== normalized) {
    currentWorkspacePath = normalized;
    configCache = null;
  }
}

function normalizeCandidate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return normalizePath(trimmed);
}

/**
 * Resolve workspace path for startup. Legacy home config is checked first so
 * existing users upgrading to the new version keep their library without re-selecting.
 * Configured paths are trusted without a pre-flight exists() check (Windows path checks can fail spuriously).
 */
export async function resolveInitialWorkspacePath(): Promise<string | null> {
  const launchPath = normalizeCandidate(getWorkspacePathFromLaunchUrl());
  if (launchPath) {
    console.info('[tinynote] Resolved workspace from launch URL:', launchPath);
    return launchPath;
  }

  const legacy = await loadLegacyHomeConfig();
  const legacyPath = normalizeCandidate(legacy?.storagePath);
  if (legacyPath) {
    console.info('[tinynote] Resolved workspace from legacy home config:', legacyPath);
    return legacyPath;
  }

  const registry = await loadWorkspacesRegistry();
  const registryPath = normalizeCandidate(registry.lastActivePath)
    ?? normalizeCandidate(registry.workspaces[0]?.path);
  if (registryPath) {
    console.info('[tinynote] Resolved workspace from work-spaces registry:', registryPath);
    return registryPath;
  }

  const sessionPath = normalizeCandidate(getSessionWorkspaceOverride());
  if (sessionPath) return sessionPath;

  if (typeof localStorage !== 'undefined') {
    const localPath = normalizeCandidate(localStorage.getItem('tinynote-storagePath'));
    if (localPath) return localPath;
  }

  console.warn('[tinynote] No workspace path found in legacy config or registry');
  return null;
}

/** Bind workspace, migrate legacy home config into library, register in work-spaces.json. */
export async function prepareWorkspace(storagePath: string): Promise<AppConfig> {
  const normalizedPath = normalizePath(storagePath);
  bindWorkspace(normalizedPath);
  await ensureWorkspaceConfigMigrated(normalizedPath);
  await registerWorkspace(normalizedPath);
  setSessionWorkspaceOverride(normalizedPath);
  return loadConfig();
}

async function runBootstrap(): Promise<string | null> {
  const workspacePath = await resolveInitialWorkspacePath();
  if (!workspacePath) {
    bindWorkspace(null);
    return null;
  }

  await prepareWorkspace(workspacePath);
  return workspacePath;
}

/** Idempotent: ensure library .tinynotes/configs.jsonc exists and legacy home config is archived. */
export async function syncWorkspaceConfigMigration(storagePath: string): Promise<void> {
  await ensureWorkspaceConfigMigrated(normalizePath(storagePath));
}

/**
 * Startup bootstrap: resolve path from legacy/registry, migrate config into library if needed.
 * Cached and deduplicated for React StrictMode double-mount.
 */
export async function bootstrapApplication(): Promise<string | null> {
  if (bootstrappedWorkspacePath !== undefined) {
    return bootstrappedWorkspacePath;
  }
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = runBootstrap()
    .then((path) => {
      bootstrappedWorkspacePath = path;
      return path;
    })
    .finally(() => {
      bootstrapPromise = null;
    });

  return bootstrapPromise;
}

async function applyLocalSettings(config: AppConfig, workspacePath: string): Promise<AppConfig> {
  const local = await loadWorkspaceLocalSettings(workspacePath);
  return {
    ...config,
    backupDir: local.backupDir ?? null,
    syncAuthToken: local.syncAuthToken ?? null,
    llmProviders: local.llmProviders ?? DEFAULT_LLM_PROVIDERS.map((provider) => ({ ...provider })),
  };
}

export async function loadConfig(): Promise<AppConfig> {
  if (!currentWorkspacePath) {
    const result: AppConfig = { ...DEFAULT_CONFIG };
    configCache = result;
    return result;
  }

  try {
    const parsed = await loadWorkspaceConfigFile(currentWorkspacePath);
    const base: AppConfig = parsed ?? {
      ...DEFAULT_CONFIG,
      storagePath: currentWorkspacePath,
    };
    const result = await applyLocalSettings(base, currentWorkspacePath);
    configCache = result;
    return result;
  } catch (e) {
    console.warn('[tinynote] Workspace config load failed:', e);
    const result: AppConfig = { ...DEFAULT_CONFIG, storagePath: currentWorkspacePath };
    configCache = result;
    return result;
  }
}

export async function saveConfig(partial?: Partial<AppConfig>): Promise<AppConfig> {
  const current = configCache ?? (await loadConfig());
  const merged: AppConfig = { ...current, ...partial };
  if (currentWorkspacePath) {
    merged.storagePath = currentWorkspacePath;
  }
  configCache = merged;

  if (currentWorkspacePath) {
    const localPatch: Partial<{
      backupDir: string | null;
      syncAuthToken: string | null;
      llmProviders: LLMProviderConfig[];
    }> = {};
    if (partial && 'backupDir' in partial) {
      localPatch.backupDir = merged.backupDir;
    }
    if (partial && 'syncAuthToken' in partial) {
      localPatch.syncAuthToken = merged.syncAuthToken;
    }
    if (partial && 'llmProviders' in partial) {
      localPatch.llmProviders = merged.llmProviders;
    }
    if (Object.keys(localPatch).length > 0) {
      try {
        await saveWorkspaceLocalSettings(currentWorkspacePath, localPatch);
      } catch (e) {
        console.error('[tinynote] Failed to save workspace local settings:', e);
      }
    }

    try {
      await saveWorkspaceConfigFile(currentWorkspacePath, merged);
      await registerWorkspace(currentWorkspacePath);
    } catch (e) {
      console.error('[tinynote] Failed to save workspace config:', e);
    }
  }

  return merged;
}

export function getConfig(): AppConfig {
  if (!configCache) {
    configCache = {
      ...DEFAULT_CONFIG,
      storagePath: currentWorkspacePath,
    };
  }
  return configCache;
}

export function clearConfigCache(): void {
  configCache = null;
}

export async function listRegisteredWorkspaces() {
  const registry = await loadWorkspacesRegistry();
  return registry.workspaces;
}

export type { AppConfig } from '@/utils/configTypes';
