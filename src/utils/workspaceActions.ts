import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit } from '@tauri-apps/api/event';
import { selectStoragePath } from '@/utils/fileSystem';
import { normalizePath, basename } from '@/utils/path';
import { listRegisteredWorkspaces } from '@/utils/config';
import { registerWorkspace } from '@/utils/workspaces';

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

export function openSettingsFromMenu(): void {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}
