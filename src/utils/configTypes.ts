import type { RecentNotebookHistoryItem, SpaceGroupDef, SpaceGroupDisplayMode } from '@/types';
import type { AppLocale } from '@/i18n';
import type { GitRemoteProvider } from '@/adapters/sync/gitProviders';

export type SyncMode = 'none' | 'git' | 'cloud';

export interface GitRemoteConfig {
  id: string;
  name: string;
  provider: GitRemoteProvider;
  url: string;
  enabled: boolean;
  host?: string | null;
}

export interface GitRemoteAuth {
  username: string;
  token: string;
}

export type BuiltinLLMProviderId = 'openai' | 'opencode-go' | 'opencode-zen' | 'deepseek';
export type LLMProviderId = BuiltinLLMProviderId | string;

export const BUILTIN_LLM_PROVIDER_IDS: readonly BuiltinLLMProviderId[] = [
  'openai',
  'opencode-go',
  'opencode-zen',
  'deepseek',
];

export function isBuiltinLLMProviderId(id: string): id is BuiltinLLMProviderId {
  return (BUILTIN_LLM_PROVIDER_IDS as readonly string[]).includes(id);
}

export function isCustomLLMProviderId(id: string): boolean {
  return id === 'custom' || id.startsWith('custom-');
}

export function nextCustomLLMProviderId(existingIds: string[]): string {
  if (!existingIds.includes('custom')) return 'custom';
  let n = 2;
  while (existingIds.includes(`custom-${n}`)) n += 1;
  return `custom-${n}`;
}

export function customLLMProviderOrdinal(providers: { id: string }[], id: string): number {
  if (!isCustomLLMProviderId(id)) return 0;
  return providers.filter((provider) => isCustomLLMProviderId(provider.id)).findIndex((provider) => provider.id === id) + 1;
}

/** Built-in virtual group that always shows every space. */
export const ALL_SPACE_GROUP_ID = '__all__';

export type { SpaceGroupDef, SpaceGroupDisplayMode };

export interface LLMModelConfig {
  id: string;
  enabled: boolean;
}

export interface LLMProviderConfig {
  id: LLMProviderId;
  enabled: boolean;
  apiKey: string | null;
  baseUrl: string;
  model: string;
  /** Models obtained from the provider's OpenAI-compatible /models endpoint. */
  models?: LLMModelConfig[];
}

export const CUSTOM_LLM_PROVIDER_TEMPLATE: LLMProviderConfig = {
  id: 'custom',
  enabled: false,
  apiKey: null,
  baseUrl: '',
  model: '',
};

export const DEFAULT_LLM_PROVIDERS: LLMProviderConfig[] = [
  { id: 'openai', enabled: false, apiKey: null, baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.4-mini' },
  { id: 'opencode-go', enabled: false, apiKey: null, baseUrl: 'https://opencode.ai/zen/go/v1', model: 'deepseek-v4-flash' },
  { id: 'opencode-zen', enabled: false, apiKey: null, baseUrl: 'https://opencode.ai/zen/v1', model: 'gpt-5.4' },
  { id: 'deepseek', enabled: false, apiKey: null, baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash' },
  { ...CUSTOM_LLM_PROVIDER_TEMPLATE },
];

export type NoteBlockDoubleClickAction = 'none' | 'copyContent';

export interface AppConfig {
  isDarkTheme: boolean;
  colorThemeId: string;
  /** null = unset; first launch resolves from system language then persists. */
  displayLanguage: AppLocale | null;
  isSidebarCollapsed: boolean;
  zoomLevel: number;
  showAppBar: boolean;
  showDirectoryPanel: boolean;
  directoryPanelWidth: number;
  appBarWidth: number;
  hideElementBorders: boolean;
  viewMode: string;
  /** Action when double-clicking a note block in the list. */
  noteBlockDoubleClickAction: NoteBlockDoubleClickAction;
  storagePath: string | null;
  backupDir: string | null;
  spaceOrder: string[];
  spaceIcons: Record<string, string>;
  /** User-defined space groups (excludes the virtual "All" group). */
  spaceGroups: SpaceGroupDef[];
  /** spacePath -> group ids (a space may belong to multiple groups). */
  spaceGroupAssignments: Record<string, string[]>;
  /** Active space-group filter; `__all__` means show every space. */
  currentSpaceGroupId: string;
  /** How space groups are presented in the space bar. */
  spaceGroupDisplayMode: SpaceGroupDisplayMode;
  groupOrder: Record<string, string[]>;
  currentSpacePath: string | null;
  currentGroupPath: string | null;
  currentNotebookPath: string | null;
  expandedGroupPaths: string[];
  syncMode: SyncMode;
  gitRemotes: GitRemoteConfig[];
  syncPrimaryRemote: string | null;
  gitRemoteAuth: Record<string, GitRemoteAuth>;
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
  colorThemeId: 'matcha',
  displayLanguage: null,
  isSidebarCollapsed: false,
  zoomLevel: 1,
  showAppBar: true,
  showDirectoryPanel: true,
  directoryPanelWidth: 300,
  appBarWidth: 200,
  hideElementBorders: false,
  viewMode: 'list',
  noteBlockDoubleClickAction: 'none',
  storagePath: null,
  backupDir: null,
  spaceOrder: [],
  spaceIcons: {},
  spaceGroups: [],
  spaceGroupAssignments: {},
  currentSpaceGroupId: ALL_SPACE_GROUP_ID,
  spaceGroupDisplayMode: 'dropdown',
  groupOrder: {},
  currentSpacePath: null,
  currentGroupPath: null,
  currentNotebookPath: null,
  expandedGroupPaths: [],
  syncMode: 'none',
  gitRemotes: [],
  syncPrimaryRemote: null,
  gitRemoteAuth: {},
  syncRemoteUrl: null,
  syncBranch: 'main',
  gitCorsProxy: 'https://cors.isomorphic-git.org',
  syncAuthToken: null,
  llmProviders: DEFAULT_LLM_PROVIDERS.map((provider) => ({ ...provider })),
  lastSyncAt: null,
  recentNotebookHistory: [],
};
