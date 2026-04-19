import { readTextFile, writeTextFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';

export interface AppConfig {
  isDarkTheme: boolean;
  isSidebarCollapsed: boolean;
  viewMode: string;
  storagePath: string | null;
  spaceOrder: string[];
  spaceIcons: Record<string, string>;
  groupOrder: Record<string, string[]>;
  currentSpacePath: string | null;
  currentGroupPath: string | null;
  currentNotebookPath: string | null;
  expandedGroupPaths: string[];
}

const DEFAULT_CONFIG: AppConfig = {
  isDarkTheme: false,
  isSidebarCollapsed: false,
  viewMode: 'list',
  storagePath: null,
  spaceOrder: [],
  spaceIcons: {},
  groupOrder: {},
  currentSpacePath: null,
  currentGroupPath: null,
  currentNotebookPath: null,
  expandedGroupPaths: [],
};

const CONFIG_DIR = '.tinynotes';
const CONFIG_FILE = '.tinynotes/configs.json';
const HOME = BaseDirectory.Home;

let configCache: AppConfig | null = null;

async function ensureConfigDir(): Promise<void> {
  try {
    const dirExists = await exists(CONFIG_DIR, { baseDir: HOME });
    if (!dirExists) {
      await mkdir(CONFIG_DIR, { recursive: true, baseDir: HOME });
    }
  } catch {
    try {
      await mkdir(CONFIG_DIR, { recursive: true, baseDir: HOME });
    } catch (e) {
      console.error('[tinynote] Failed to create config dir:', e);
    }
  }
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    await ensureConfigDir();
    const content = await readTextFile(CONFIG_FILE, { baseDir: HOME });
    const parsed = JSON.parse(content);
    const result: AppConfig = { ...DEFAULT_CONFIG, ...parsed };
    configCache = result;
    return result;
  } catch (e) {
    console.warn('[tinynote] Config load failed, creating default:', e);
    const result: AppConfig = { ...DEFAULT_CONFIG };
    configCache = result;
    try {
      await ensureConfigDir();
      await writeTextFile(CONFIG_FILE, JSON.stringify(result, null, 2), { create: true, baseDir: HOME });
    } catch (writeErr) {
      console.error('[tinynote] Failed to write default config:', writeErr);
    }
    return result;
  }
}

export async function saveConfig(partial?: Partial<AppConfig>): Promise<AppConfig> {
  const current = configCache ?? { ...DEFAULT_CONFIG };
  const merged: AppConfig = { ...current, ...partial };
  configCache = merged;
  try {
    await ensureConfigDir();
    await writeTextFile(CONFIG_FILE, JSON.stringify(merged, null, 2), { create: true, baseDir: HOME });
  } catch (e) {
    console.error('[tinynote] Failed to save config:', e);
  }
  return merged;
}

export function getConfig(): AppConfig {
  if (!configCache) {
    configCache = { ...DEFAULT_CONFIG };
  }
  return configCache;
}

export function clearConfigCache(): void {
  configCache = null;
}