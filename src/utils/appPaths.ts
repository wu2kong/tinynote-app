import { invoke } from '@tauri-apps/api/core';
import { homeDir, join } from '@tauri-apps/api/path';
import { isWeb } from '@/platform/detect';
import { getBoundWorkspacePath } from '@/utils/config';
import { getWorkspacesRegistryDisplayPath } from '@/utils/workspaces';
import { getWorkspaceConfigJsoncPath } from '@/utils/workspaceConfig';
import { normalizePath } from './path';

const LEGACY_HOME_CONFIG = '.tinynotes/configs.json';

export async function getConfigFilePath(workspacePath?: string | null): Promise<string | null> {
  const bound = workspacePath ?? getBoundWorkspacePath();
  if (bound) {
    return getWorkspaceConfigJsoncPath(bound);
  }
  if (isWeb()) {
    return getWorkspacesRegistryDisplayPath();
  }
  try {
    const home = await homeDir();
    return normalizePath(await join(home, LEGACY_HOME_CONFIG));
  } catch {
    return null;
  }
}

export async function getWorkspacesFilePath(): Promise<string> {
  if (isWeb()) {
    return getWorkspacesRegistryDisplayPath();
  }
  try {
    const home = await homeDir();
    return normalizePath(await join(home, '.tinynotes/work-spaces.json'));
  } catch {
    return '~/.tinynotes/work-spaces.json';
  }
}

export async function getAppDirectory(): Promise<string> {
  const dir = await invoke<string>('get_app_dir');
  return normalizePath(dir);
}
