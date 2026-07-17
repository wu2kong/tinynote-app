import type { RecentNotebookHistoryItem } from '@/types';

export type LLMProviderId = 'openai' | 'opencode-go' | 'custom';

export interface LLMProviderConfig {
  id: LLMProviderId;
  enabled: boolean;
  apiKey: string | null;
  baseUrl: string;
  model: string;
}

export const DEFAULT_LLM_PROVIDERS: LLMProviderConfig[] = [
  { id: 'openai', enabled: false, apiKey: null, baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' },
  { id: 'opencode-go', enabled: false, apiKey: null, baseUrl: 'https://opencode.ai/zen/go/v1', model: 'kimi-k2.7-code' },
  { id: 'custom', enabled: false, apiKey: null, baseUrl: '', model: '' },
];

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
  llmProviders: LLMProviderConfig[];
  lastSyncAt: string | null;
  recentNotebookHistory: RecentNotebookHistoryItem[];
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
  llmProviders: DEFAULT_LLM_PROVIDERS.map((provider) => ({ ...provider })),
  lastSyncAt: null,
  recentNotebookHistory: [],
};
