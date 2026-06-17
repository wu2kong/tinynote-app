import { getStorageAdapter } from '@/adapters/storage';
import { loadLegacyHomeConfig, archiveLegacyHomeConfig } from '@/adapters/config/legacyHomeConfig';
import { AppConfig, DEFAULT_CONFIG } from '@/utils/configTypes';
import { configPathsToAbsolute, configPathsToRelative, isAbsoluteConfigPath } from '@/utils/configPaths';
import { parseJsonc, stringifyJsonc } from '@/utils/jsonc';
import { joinPath, normalizePath } from '@/utils/path';
import { saveWorkspaceLocalSettings } from '@/utils/workspaces';

/** Synced workspace config — paths are relative to the library root; no machine-local fields. */
export type WorkspaceConfigFile = Omit<AppConfig, 'storagePath' | 'backupDir' | 'syncAuthToken'>;

const CONFIG_DIR = '.tinynotes';
export const WORKSPACE_CONFIG_DIR = CONFIG_DIR;
const CONFIG_JSONC = '.tinynotes/configs.jsonc';
const CONFIG_JSON = '.tinynotes/configs.json';

function storage() {
  return getStorageAdapter();
}

export function isNoteSpaceDirectoryName(name: string): boolean {
  return name.endsWith('.tinynotes') && name !== WORKSPACE_CONFIG_DIR;
}

function toWorkspaceFile(workspaceRoot: string, config: AppConfig): WorkspaceConfigFile {
  const {
    storagePath: _storagePath,
    backupDir: _backupDir,
    syncAuthToken: _syncAuthToken,
    ...rest
  } = config;
  return configPathsToRelative(workspaceRoot, rest) as WorkspaceConfigFile;
}

function fromWorkspaceFile(workspacePath: string, partial: Partial<WorkspaceConfigFile> | null): AppConfig {
  const root = normalizePath(workspacePath);
  const merged: AppConfig = {
    ...DEFAULT_CONFIG,
    ...partial,
    storagePath: root,
    backupDir: null,
    syncAuthToken: null,
  };
  return {
    ...merged,
    ...configPathsToAbsolute(root, merged),
    storagePath: root,
    backupDir: null,
    syncAuthToken: null,
  };
}

export function getWorkspaceConfigJsoncPath(workspacePath: string): string {
  return joinPath(normalizePath(workspacePath), CONFIG_JSONC);
}

export function getWorkspaceConfigJsonPath(workspacePath: string): string {
  return joinPath(normalizePath(workspacePath), CONFIG_JSON);
}

export async function workspaceConfigExists(workspacePath: string): Promise<boolean> {
  const root = normalizePath(workspacePath);
  return (
    (await storage().exists(getWorkspaceConfigJsoncPath(root)))
    || (await storage().exists(getWorkspaceConfigJsonPath(root)))
  );
}

function workspaceFileNeedsRelativization(partial: Partial<WorkspaceConfigFile>): boolean {
  const hasAbsolute = (path: string | null | undefined) => Boolean(path && isAbsoluteConfigPath(path));

  if (partial.spaceOrder?.some(hasAbsolute)) return true;
  if (partial.expandedGroupPaths?.some(hasAbsolute)) return true;
  if (hasAbsolute(partial.currentSpacePath) || hasAbsolute(partial.currentGroupPath) || hasAbsolute(partial.currentNotebookPath)) {
    return true;
  }
  if (partial.spaceIcons && Object.keys(partial.spaceIcons).some(hasAbsolute)) return true;
  if (partial.groupOrder) {
    for (const [parent, children] of Object.entries(partial.groupOrder)) {
      if (hasAbsolute(parent) || children.some(hasAbsolute)) return true;
    }
  }
  if ('backupDir' in partial || 'syncAuthToken' in partial) return true;
  return false;
}

async function loadWorkspaceConfigContent(
  root: string,
  partial: Partial<WorkspaceConfigFile>,
): Promise<AppConfig> {
  const config = fromWorkspaceFile(root, partial);
  if (workspaceFileNeedsRelativization(partial)) {
    const legacyPartial = partial as Partial<WorkspaceConfigFile> & {
      backupDir?: string | null;
      syncAuthToken?: string | null;
    };
    if (legacyPartial.backupDir != null || legacyPartial.syncAuthToken != null) {
      await saveWorkspaceLocalSettings(root, {
        backupDir: legacyPartial.backupDir ?? null,
        syncAuthToken: legacyPartial.syncAuthToken ?? null,
      });
    }
    await saveWorkspaceConfigFile(root, config);
  }
  return config;
}

export async function loadWorkspaceConfigFile(workspacePath: string): Promise<AppConfig | null> {
  const root = normalizePath(workspacePath);
  const jsoncPath = getWorkspaceConfigJsoncPath(root);
  const jsonPath = getWorkspaceConfigJsonPath(root);

  if (await storage().exists(jsoncPath)) {
    const content = await storage().readTextFile(jsoncPath);
    return loadWorkspaceConfigContent(root, parseJsonc<Partial<WorkspaceConfigFile>>(content));
  }

  if (await storage().exists(jsonPath)) {
    const content = await storage().readTextFile(jsonPath);
    return loadWorkspaceConfigContent(root, JSON.parse(content) as Partial<WorkspaceConfigFile>);
  }

  return null;
}

export async function saveWorkspaceConfigFile(workspacePath: string, config: AppConfig): Promise<void> {
  const root = normalizePath(workspacePath);
  await storage().mkdir(joinPath(root, CONFIG_DIR), true);
  const payload = toWorkspaceFile(root, config);
  await storage().writeTextFile(getWorkspaceConfigJsoncPath(root), stringifyJsonc(payload));
}

export async function ensureWorkspaceConfigMigrated(workspacePath: string): Promise<void> {
  const root = normalizePath(workspacePath);
  const legacyHome = await loadLegacyHomeConfig();

  if (await workspaceConfigExists(root)) {
    if (legacyHome) {
      await archiveLegacyHomeConfig();
    }
    return;
  }

  await storage().mkdir(joinPath(root, CONFIG_DIR), true);

  const base: AppConfig = legacyHome
    ? {
        ...DEFAULT_CONFIG,
        ...legacyHome,
        storagePath: root,
      }
    : {
        ...DEFAULT_CONFIG,
        storagePath: root,
      };

  await saveWorkspaceConfigFile(root, base);

  if (legacyHome && (legacyHome.backupDir != null || legacyHome.syncAuthToken != null)) {
    await saveWorkspaceLocalSettings(root, {
      backupDir: legacyHome.backupDir ?? null,
      syncAuthToken: legacyHome.syncAuthToken ?? null,
    });
  }

  if (legacyHome) {
    await archiveLegacyHomeConfig();
    console.info('[tinynote] Migrated ~/.tinynotes/configs.json to', getWorkspaceConfigJsoncPath(root));
  } else {
    console.info('[tinynote] Created workspace config at', getWorkspaceConfigJsoncPath(root));
  }
}
