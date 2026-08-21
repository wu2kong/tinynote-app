import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit } from '@tauri-apps/api/event';
import { selectStoragePath } from '@/utils/fileSystem';
import { normalizePath, basename, joinPath } from '@/utils/path';
import { getBoundWorkspacePath, listRegisteredWorkspaces } from '@/utils/config';
import { getConfigFilePath } from '@/utils/appPaths';
import { createBackup, selectBackupDir } from '@/utils/backup';
import { clearRecentWorkspaces, registerWorkspace, unregisterWorkspace } from '@/utils/workspaces';
import { showToast } from '@/components/Toast';
import { t } from '@/i18n';

export const WORKSPACE_SWITCH_EVENT = 'tinynote-workspace-switch';
export const OPEN_SETTINGS_EVENT = 'tinynote-open-settings';

function buildAppUrl(workspacePath: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('workspace', workspacePath);
  return url.toString();
}

function uniqueWindowLabel(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

export async function pickWorkspaceDirectory(): Promise<string | null> {
  const selected = await selectStoragePath();
  return selected ? normalizePath(selected) : null;
}

export async function openWorkspaceInCurrentWindow(path: string): Promise<void> {
  const normalizedPath = normalizePath(path);
  await registerWorkspace(normalizedPath);
  await emit(WORKSPACE_SWITCH_EVENT, { path: normalizedPath });
}

export async function openWorkspaceInNewWindow(path: string): Promise<void> {
  const normalizedPath = normalizePath(path);
  await registerWorkspace(normalizedPath);

  const label = uniqueWindowLabel('workspace');
  const webview = new WebviewWindow(label, {
    url: buildAppUrl(normalizedPath),
    title: basename(normalizedPath) || 'TinyNote',
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
  });

  webview.once('tauri://error', (event) => {
    console.error('[tinynote] Failed to open workspace window:', event);
  });
}

export async function promptAndOpenWorkspaceInCurrentWindow(): Promise<void> {
  const path = await pickWorkspaceDirectory();
  if (path) {
    await openWorkspaceInCurrentWindow(path);
  }
}

export async function promptAndOpenWorkspaceInNewWindow(): Promise<void> {
  const path = await pickWorkspaceDirectory();
  if (path) {
    await openWorkspaceInNewWindow(path);
  }
}

export async function closeCurrentWindow(): Promise<void> {
  await getCurrentWebviewWindow().close();
}

export async function loadRecentWorkspaceEntries() {
  const workspaces = await listRegisteredWorkspaces();
  return workspaces.slice(0, 10);
}

export async function removeRecentWorkspace(path: string): Promise<void> {
  const current = getBoundWorkspacePath();
  if (current && normalizePath(current) === normalizePath(path)) return;
  await unregisterWorkspace(path);
}

export async function promptAndClearRecentWorkspaces(): Promise<boolean> {
  const { ask } = await import('@tauri-apps/plugin-dialog');
  const confirmed = await ask(t('menu.clearRecentWorkspacesConfirm'), {
    title: t('menu.clearRecentWorkspaces'),
    kind: 'warning',
    okLabel: t('menu.clearRecentWorkspaces'),
    cancelLabel: t('common.cancel'),
  });
  if (!confirmed) return false;
  await clearRecentWorkspaces(getBoundWorkspacePath());
  return true;
}

export async function promptAndExportLibrary(): Promise<void> {
  const storagePath = getBoundWorkspacePath();
  if (!storagePath) {
    showToast(t('menu.exportLibraryNoWorkspace'));
    return;
  }

  const targetDir = await selectBackupDir();
  if (!targetDir) return;

  try {
    const configPath = await getConfigFilePath(storagePath);
    const filename = await createBackup(targetDir, storagePath, configPath ?? '');
    const zipPath = joinPath(targetDir, filename);
    showToast(t('menu.exportLibraryCompleted', { filename }));
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(zipPath);
    } catch (error) {
      console.error('[tinynote] Failed to reveal exported library:', error);
      const { openPath } = await import('@tauri-apps/plugin-opener');
      await openPath(targetDir);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : t('menu.exportLibraryFailed');
    console.error('[tinynote] Failed to export library:', error);
    showToast(message);
  }
}

export function openSettingsFromMenu(): void {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}
