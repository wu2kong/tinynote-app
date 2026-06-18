import {
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from '@tauri-apps/api/menu';
import { getBoundWorkspacePath } from '@/utils/config';
import { basename, normalizePath } from '@/utils/path';
import {
  closeCurrentWindow,
  loadRecentWorkspaceEntries,
  openSettingsFromMenu,
  openWorkspaceInCurrentWindow,
  promptAndOpenWorkspaceInCurrentWindow,
  promptAndOpenWorkspaceInNewWindow,
} from '@/utils/workspaceActions';

const APP_NAME = 'TinyNote';
const MAX_RECENT = 10;

function isMacOS(): boolean {
  return /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
}

function workspaceMenuLabel(path: string, label?: string): string {
  const name = label?.trim() || basename(path) || path;
  const normalized = normalizePath(path);
  const home = normalized.replace(/^\/Users\/[^/]+/, '~');
  if (home !== normalized) {
    return `${name} (${home})`;
  }
  return `${name} (${normalized})`;
}

async function buildRecentWorkspacesSubmenu(): Promise<Submenu> {
  const currentPath = getBoundWorkspacePath();
  const entries = await loadRecentWorkspaceEntries();
  const items = entries.length > 0
    ? await Promise.all(
        entries.slice(0, MAX_RECENT).map(async (entry, index) => {
          const normalizedPath = normalizePath(entry.path);
          const isCurrent = currentPath != null && normalizePath(currentPath) === normalizedPath;
          return MenuItem.new({
            id: `recent-workspace-${index}`,
            text: `${isCurrent ? '✓ ' : ''}${workspaceMenuLabel(entry.path, entry.label)}`,
            action: () => {
              void openWorkspaceInCurrentWindow(normalizedPath);
            },
          });
        }),
      )
    : [
        await MenuItem.new({
          id: 'recent-workspace-empty',
          text: '（无最近工作区）',
          enabled: false,
        }),
      ];

  return Submenu.new({
    id: 'recent-workspaces',
    text: '最近的工作区',
    items,
  });
}

async function buildFileSubmenu(): Promise<Submenu> {
  const recentSubmenu = await buildRecentWorkspacesSubmenu();
  const fileSubmenu = await Submenu.new({
    id: 'file-menu',
    text: '文件',
    items: [
      await MenuItem.new({
        id: 'open-workspace',
        text: '打开工作区…',
        accelerator: 'CommandOrControl+O',
        action: () => {
          void promptAndOpenWorkspaceInCurrentWindow();
        },
      }),
      await MenuItem.new({
        id: 'open-workspace-new-window',
        text: '在新窗口打开工作区…',
        accelerator: 'CommandOrControl+Shift+O',
        action: () => {
          void promptAndOpenWorkspaceInNewWindow();
        },
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      recentSubmenu,
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        id: 'close-window',
        text: '关闭窗口',
        accelerator: 'CommandOrControl+W',
        action: () => {
          void closeCurrentWindow();
        },
      }),
    ],
  });

  if (!isMacOS()) {
    await fileSubmenu.append([
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        id: 'settings',
        text: '设置…',
        accelerator: 'CommandOrControl+,',
        action: openSettingsFromMenu,
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Quit' }),
    ]);
  }

  return fileSubmenu;
}

async function buildAppSubmenu(): Promise<Submenu> {
  return Submenu.new({
    id: 'app-menu',
    text: APP_NAME,
    items: [
      await MenuItem.new({
        id: 'about',
        text: `关于 ${APP_NAME}`,
        action: openSettingsFromMenu,
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        id: 'settings',
        text: '设置…',
        accelerator: 'CommandOrControl+,',
        action: openSettingsFromMenu,
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Services' }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Hide' }),
      await PredefinedMenuItem.new({ item: 'HideOthers' }),
      await PredefinedMenuItem.new({ item: 'ShowAll' }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Quit' }),
    ],
  });
}

async function buildEditSubmenu(): Promise<Submenu> {
  return Submenu.new({
    id: 'edit-menu',
    text: '编辑',
    items: [
      await PredefinedMenuItem.new({ item: 'Undo' }),
      await PredefinedMenuItem.new({ item: 'Redo' }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Cut' }),
      await PredefinedMenuItem.new({ item: 'Copy' }),
      await PredefinedMenuItem.new({ item: 'Paste' }),
      await PredefinedMenuItem.new({ item: 'SelectAll' }),
    ],
  });
}

async function buildViewSubmenu(): Promise<Submenu> {
  return Submenu.new({
    id: 'view-menu',
    text: '视图',
    items: [
      await MenuItem.new({
        id: 'toggle-app-bar',
        text: '切换侧边栏',
        accelerator: 'CommandOrControl+1',
        action: () => {
          void import('@tauri-apps/api/event').then(({ emit }) => emit('toggle_app_bar'));
        },
      }),
      await MenuItem.new({
        id: 'toggle-directory',
        text: '切换目录面板',
        accelerator: 'CommandOrControl+2',
        action: () => {
          void import('@tauri-apps/api/event').then(({ emit }) => emit('toggle_directory'));
        },
      }),
    ],
  });
}

async function buildMenu(): Promise<Menu> {
  const fileSubmenu = await buildFileSubmenu();
  const editSubmenu = await buildEditSubmenu();
  const viewSubmenu = await buildViewSubmenu();

  const items = isMacOS()
    ? [await buildAppSubmenu(), fileSubmenu, editSubmenu, viewSubmenu]
    : [fileSubmenu, editSubmenu, viewSubmenu];

  return Menu.new({ items });
}

export async function initDesktopMenu(): Promise<void> {
  const menu = await buildMenu();
  await menu.setAsAppMenu();
}

export async function refreshDesktopMenu(): Promise<void> {
  await initDesktopMenu();
}
