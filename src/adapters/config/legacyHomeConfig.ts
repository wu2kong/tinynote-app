import { readTextFile, writeTextFile, remove, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { isTauri, isWeb } from '@/platform/detect';
import type { AppConfig } from '@/utils/configTypes';

const LEGACY_CONFIG_FILE = '.tinynotes/configs.json';
const LEGACY_CONFIG_ARCHIVED = '.tinynotes/configs.json.migrated';
const HOME = BaseDirectory.Home;
const WEB_LEGACY_KEY = 'tinynote.config.v1';

async function readHomeJson(relativePath: string): Promise<AppConfig | null> {
  try {
    if (!(await exists(relativePath, { baseDir: HOME }))) {
      return null;
    }
    const content = await readTextFile(relativePath, { baseDir: HOME });
    const parsed = JSON.parse(content) as AppConfig;
    if (parsed.storagePath != null && String(parsed.storagePath).trim()) {
      console.info(`[tinynote] Loaded legacy config from ~/${relativePath}`);
    }
    return parsed;
  } catch (error) {
    console.warn(`[tinynote] Failed to read ~/${relativePath}:`, error);
    return null;
  }
}

export async function loadLegacyHomeConfig(): Promise<AppConfig | null> {
  if (isTauri()) {
    const active = await readHomeJson(LEGACY_CONFIG_FILE);
    if (active) return active;
    return readHomeJson(LEGACY_CONFIG_ARCHIVED);
  }

  if (isWeb()) {
    try {
      const raw = localStorage.getItem(WEB_LEGACY_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AppConfig;
    } catch {
      return null;
    }
  }

  return null;
}

export async function hasPendingLegacyHomeConfig(): Promise<boolean> {
  if (isWeb()) {
    return Boolean(localStorage.getItem(WEB_LEGACY_KEY));
  }
  return (await exists(LEGACY_CONFIG_FILE, { baseDir: HOME }))
    || (await exists(LEGACY_CONFIG_ARCHIVED, { baseDir: HOME }));
}

export async function archiveLegacyHomeConfig(): Promise<void> {
  if (isWeb()) {
    localStorage.removeItem(WEB_LEGACY_KEY);
    return;
  }

  try {
    if (!(await exists(LEGACY_CONFIG_FILE, { baseDir: HOME }))) {
      return;
    }
    const content = await readTextFile(LEGACY_CONFIG_FILE, { baseDir: HOME });
    await writeTextFile(LEGACY_CONFIG_ARCHIVED, content, { create: true, baseDir: HOME });
    await remove(LEGACY_CONFIG_FILE, { baseDir: HOME });
  } catch (e) {
    console.warn('[tinynote] Failed to archive legacy home config:', e);
  }
}
