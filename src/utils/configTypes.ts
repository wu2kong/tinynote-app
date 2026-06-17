export interface AppConfig {
  isDarkTheme: boolean;
  colorThemeId: string;
  isSidebarCollapsed: boolean;
  zoomLevel: number;
  showAppBar: boolean;
  showDirectoryPanel: boolean;
  directoryPanelWidth: number;
  appBarWidth: number;
  hideElementBorders: boolean;
  viewMode: string;
  storagePath: string | null;
  backupDir: string | null;
  spaceOrder: string[];
  spaceIcons: Record<string, string>;
  groupOrder: Record<string, string[]>;
  currentSpacePath: string | null;
  currentGroupPath: string | null;
  currentNotebookPath: string | null;
  expandedGroupPaths: string[];
  syncRemoteUrl: string | null;
  syncBranch: string;
  gitCorsProxy: string;
  syncAuthToken: string | null;
  lastSyncAt: string | null;
}

export const DEFAULT_CONFIG: AppConfig = {
  isDarkTheme: false,
  colorThemeId: 'default',
  isSidebarCollapsed: false,
  zoomLevel: 1,
  showAppBar: true,
  showDirectoryPanel: true,
  directoryPanelWidth: 300,
  appBarWidth: 200,
  hideElementBorders: false,
  viewMode: 'list',
  storagePath: null,
  backupDir: null,
  spaceOrder: [],
  spaceIcons: {},
  groupOrder: {},
  currentSpacePath: null,
  currentGroupPath: null,
  currentNotebookPath: null,
  expandedGroupPaths: [],
  syncRemoteUrl: null,
  syncBranch: 'main',
  gitCorsProxy: 'https://cors.isomorphic-git.org',
  syncAuthToken: null,
  lastSyncAt: null,
};
