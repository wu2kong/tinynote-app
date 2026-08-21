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
  openWorkspaceInNewWindow,
  promptAndClearRecentWorkspaces,
  promptAndOpenWorkspaceInNewWindow,
  removeRecentWorkspace,
} from '@/utils/workspaceActions';
import { checkWithNativeUpdater } from '@/utils/updater';
import { HOMEPAGE_URL, DOCS_URL } from '@/constants/app';
import { t } from '@/i18n';
import { openUrl } from '@tauri-apps/plugin-opener';

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
  const currentNormalized = currentPath ? normalizePath(currentPath) : null;
  const entries = await loadRecentWorkspaceEntries();
  const visibleEntries = entries.slice(0, MAX_RECENT);
  const recentItems = visibleEntries.length > 0
    ? await Promise.all(
        visibleEntries.map(async (entry, index) => {
          const normalizedPath = normalizePath(entry.path);
          const isCurrent = currentNormalized != null && currentNormalized === normalizedPath;
          return MenuItem.new({
            id: `recent-workspace-${index}`,
            text: `${isCurrent ? '✓ ' : ''}${workspaceMenuLabel(entry.path, entry.label)}`,
            action: () => {
              if (isCurrent) return;
              void openWorkspaceInNewWindow(normalizedPath);
            },
          });
        }),
      )
    : [
        await MenuItem.new({
          id: 'recent-workspace-empty',
          text: t('menu.noRecentWorkspaces'),
          enabled: false,
        }),
      ];

  const removable = visibleEntries.filter(
    (entry) => currentNormalized == null || normalizePath(entry.path) !== currentNormalized,
  );
  if (removable.length === 0) {
    return Submenu.new({
      id: 'recent-workspaces',
      text: t('menu.recentWorkspaces'),
      items: recentItems,
    });
  }

  const removeSubmenu = await Submenu.new({
    id: 'remove-recent-workspaces',
    text: t('menu.removeFromRecent'),
    items: await Promise.all(
      removable.map(async (entry, index) => {
        const normalizedPath = normalizePath(entry.path);
        return MenuItem.new({
          id: `remove-recent-workspace-${index}`,
          text: workspaceMenuLabel(entry.path, entry.label),
          action: () => {
            void removeRecentWorkspace(normalizedPath).then(() => refreshDesktopMenu());
          },
        });
      }),
    ),
  });
  const clearItem = await MenuItem.new({
    id: 'clear-recent-workspaces',
    text: t('menu.clearRecentWorkspaces'),
    action: () => {
      void promptAndClearRecentWorkspaces().then((cleared) => {
        if (cleared) return refreshDesktopMenu();
      });
    },
  });

  return Submenu.new({
    id: 'recent-workspaces',
    text: t('menu.recentWorkspaces'),
    items: [
      ...recentItems,
      await PredefinedMenuItem.new({ item: 'Separator' }),
      removeSubmenu,
      clearItem,
    ],
  });
}

async function buildFileSubmenu(): Promise<Submenu> {
  const recentSubmenu = await buildRecentWorkspacesSubmenu();
  const fileSubmenu = await Submenu.new({
    id: 'file-menu',
    text: t('menu.file'),
    items: [
      await MenuItem.new({
        id: 'open-workspace',
        text: t('menu.openWorkspace'),
        accelerator: 'CommandOrControl+O',
        action: () => {
          void promptAndOpenWorkspaceInNewWindow();
        },
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      recentSubmenu,
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        id: 'close-window',
        text: t('menu.closeWindow'),
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
        id: 'check-for-updates',
        text: t('menu.checkForUpdates'),
        action: () => {
          void checkWithNativeUpdater().then((opened) => {
            if (!opened) openSettingsFromMenu();
          });
        },
      }),
      await MenuItem.new({
        id: 'settings',
        text: t('menu.settings'),
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
        text: t('menu.aboutApp', { app: APP_NAME }),
        action: openSettingsFromMenu,
      }),
      await MenuItem.new({
        id: 'check-for-updates',
        text: t('menu.checkForUpdates'),
        action: () => {
          void checkWithNativeUpdater().then((opened) => {
            if (!opened) openSettingsFromMenu();
          });
        },
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        id: 'settings',
        text: t('menu.settings'),
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
    text: t('menu.edit'),
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
    text: t('menu.view'),
    items: [
      await MenuItem.new({
        id: 'toggle-app-bar',
        text: t('menu.toggleSidebar'),
        accelerator: 'CommandOrControl+1',
        action: () => {
          void import('@tauri-apps/api/event').then(({ emit }) => emit('toggle_app_bar'));
        },
      }),
      await MenuItem.new({
        id: 'toggle-directory',
        text: t('menu.toggleDirectory'),
        accelerator: 'CommandOrControl+2',
        action: () => {
          void import('@tauri-apps/api/event').then(({ emit }) => emit('toggle_directory'));
        },
      }),
    ],
  });
}

async function buildHelpSubmenu(): Promise<Submenu> {
  return Submenu.new({
    id: 'help-menu',
    text: t('menu.help'),
    items: [
      await MenuItem.new({
        id: 'open-homepage',
        text: t('menu.homepage'),
        action: () => {
          void openUrl(HOMEPAGE_URL).catch((error) => {
            console.error('Failed to open homepage:', error);
          });
        },
      }),
      await MenuItem.new({
        id: 'open-help-docs',
        text: t('menu.helpDocs'),
        action: () => {
          void openUrl(DOCS_URL).catch((error) => {
            console.error('Failed to open help docs:', error);
          });
        },
      }),
    ],
  });
}

async function buildMenu(): Promise<Menu> {
  const fileSubmenu = await buildFileSubmenu();
  const editSubmenu = await buildEditSubmenu();
  const viewSubmenu = await buildViewSubmenu();
  const helpSubmenu = await buildHelpSubmenu();

  const items = isMacOS()
    ? [await buildAppSubmenu(), fileSubmenu, editSubmenu, viewSubmenu, helpSubmenu]
    : [fileSubmenu, editSubmenu, viewSubmenu, helpSubmenu];

  return Menu.new({ items });
}

export async function initDesktopMenu(): Promise<void> {
  const menu = await buildMenu();
  await menu.setAsAppMenu();
}

export async function refreshDesktopMenu(): Promise<void> {
  await initDesktopMenu();
}
