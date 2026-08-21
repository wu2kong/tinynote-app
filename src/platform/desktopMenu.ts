import {
  CheckMenuItem,
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from '@tauri-apps/api/menu';
import { getBoundWorkspacePath } from '@/utils/config';
import { basename, normalizePath } from '@/utils/path';
import { useStore } from '@/store/useStore';
import { COLOR_THEMES } from '@/themes';
import { LOCALE_OPTIONS, t } from '@/i18n';
import type { SpaceGroupDisplayMode } from '@/types';
import {
  closeCurrentWindow,
  loadRecentWorkspaceEntries,
  openSettingsFromMenu,
  openImportNotesFromMenu,
  openWorkspaceInNewWindow,
  promptAndClearRecentWorkspaces,
  promptAndExportLibrary,
  promptAndOpenWorkspaceInNewWindow,
  removeRecentWorkspace,
} from '@/utils/workspaceActions';
import { checkWithNativeUpdater } from '@/utils/updater';
import { HOMEPAGE_URL, DOCS_URL } from '@/constants/app';
import { openUrl } from '@tauri-apps/plugin-opener';

const APP_NAME = 'TinyNote';
const MAX_RECENT = 10;

const SPACE_GROUP_DISPLAY_OPTIONS: { value: SpaceGroupDisplayMode; labelKey: string }[] = [
  { value: 'disabled', labelKey: 'settings.general.spaceGroupDisabled' },
  { value: 'dropdown', labelKey: 'settings.general.spaceGroupDropdown' },
  { value: 'collapse', labelKey: 'settings.general.spaceGroupCollapse' },
];

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
        id: 'import-notes',
        text: t('menu.importNotes'),
        action: openImportNotesFromMenu,
      }),
      await MenuItem.new({
        id: 'export-library',
        text: t('menu.exportLibrary'),
        action: () => {
          void promptAndExportLibrary();
        },
      }),
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

async function buildViewSubmenu(): Promise<Submenu> {
  const {
    isDarkTheme,
    colorThemeId,
    displayLanguage,
    spaceGroupDisplayMode,
    hideElementBorders,
    isSidebarCollapsed,
    showAppBar,
    showDirectoryPanel,
  } = useStore.getState();

  const colorThemeSubmenu = await Submenu.new({
    id: 'color-theme-menu',
    text: t('settings.general.colorTheme'),
    items: await Promise.all(
      COLOR_THEMES.map((theme) =>
        CheckMenuItem.new({
          id: `color-theme-${theme.id}`,
          text: t(`settings.themes.${theme.id}.label`),
          checked: colorThemeId === theme.id,
          action: () => {
            useStore.getState().setColorTheme(theme.id);
          },
        }),
      ),
    ),
  });

  const languageSubmenu = await Submenu.new({
    id: 'display-language-menu',
    text: t('settings.general.displayLanguage'),
    items: await Promise.all(
      LOCALE_OPTIONS.map((option) =>
        CheckMenuItem.new({
          id: `display-language-${option.value}`,
          text: option.label,
          checked: displayLanguage === option.value,
          action: () => {
            useStore.getState().setDisplayLanguage(option.value);
          },
        }),
      ),
    ),
  });

  const spaceGroupSubmenu = await Submenu.new({
    id: 'space-group-display-menu',
    text: t('settings.general.spaceGroupDisplay'),
    items: await Promise.all(
      SPACE_GROUP_DISPLAY_OPTIONS.map((option) =>
        CheckMenuItem.new({
          id: `space-group-display-${option.value}`,
          text: t(option.labelKey),
          checked: spaceGroupDisplayMode === option.value,
          action: () => {
            useStore.getState().setSpaceGroupDisplayMode(option.value);
          },
        }),
      ),
    ),
  });

  const sectionHeader = (id: string, text: string) =>
    MenuItem.new({ id, text, enabled: false });

  return Submenu.new({
    id: 'view-menu',
    text: t('menu.view'),
    items: [
      await sectionHeader('view-section-global', t('menu.sectionGlobal')),
      await CheckMenuItem.new({
        id: 'toggle-dark-theme',
        text: t('settings.general.darkMode'),
        checked: isDarkTheme,
        action: () => {
          useStore.getState().toggleTheme();
        },
      }),
      colorThemeSubmenu,
      languageSubmenu,
      await CheckMenuItem.new({
        id: 'toggle-hide-borders',
        text: t('settings.general.hideBorders'),
        checked: hideElementBorders,
        action: () => {
          useStore.getState().toggleHideElementBorders();
        },
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await sectionHeader('view-section-space', t('menu.sectionSpace')),
      spaceGroupSubmenu,
      await MenuItem.new({
        id: 'collapse-expand-space-sidebar',
        text: isSidebarCollapsed
          ? t('menu.expandSpaceSidebar')
          : t('menu.collapseSpaceSidebar'),
        enabled: showAppBar,
        action: () => {
          useStore.getState().toggleSidebar();
        },
      }),
      await MenuItem.new({
        id: 'toggle-space-sidebar',
        text: showAppBar ? t('menu.hideSpaceSidebar') : t('menu.showSpaceSidebar'),
        accelerator: 'CommandOrControl+1',
        action: () => {
          useStore.getState().toggleAppBar();
        },
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await sectionHeader('view-section-directory', t('menu.sectionDirectory')),
      await MenuItem.new({
        id: 'toggle-directory-panel',
        text: showDirectoryPanel
          ? t('menu.hideDirectoryPanel')
          : t('menu.showDirectoryPanel'),
        accelerator: 'CommandOrControl+2',
        action: () => {
          useStore.getState().toggleDirectoryPanel();
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
  const viewSubmenu = await buildViewSubmenu();
  const helpSubmenu = await buildHelpSubmenu();

  const items = isMacOS()
    ? [await buildAppSubmenu(), fileSubmenu, viewSubmenu, helpSubmenu]
    : [fileSubmenu, viewSubmenu, helpSubmenu];

  return Menu.new({ items });
}

export async function initDesktopMenu(): Promise<void> {
  const menu = await buildMenu();
  await menu.setAsAppMenu();
}

export async function refreshDesktopMenu(): Promise<void> {
  await initDesktopMenu();
}
