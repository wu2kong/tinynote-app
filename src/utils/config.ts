import { isWeb } from '@/platform/detect';
import { loadTauriConfig, saveTauriConfig } from '@/adapters/config/tauriConfig';
import { loadWebConfig, saveWebConfig } from '@/adapters/config/webConfig';
import { AppConfig, DEFAULT_CONFIG } from '@/utils/configTypes';

let configCache: AppConfig | null = null;

async function readPersistedConfig(): Promise<AppConfig | null> {
  return isWeb() ? loadWebConfig() : loadTauriConfig();
}

async function writePersistedConfig(config: AppConfig): Promise<void> {
  if (isWeb()) {
    await saveWebConfig(config);
  } else {
    await saveTauriConfig(config);
  }
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const parsed = await readPersistedConfig();
    const result: AppConfig = { ...DEFAULT_CONFIG, ...parsed };
    configCache = result;
    return result;
  } catch (e) {
    console.warn('[tinynote] Config load failed, creating default:', e);
    const result: AppConfig = { ...DEFAULT_CONFIG };
    configCache = result;
    try {
      await writePersistedConfig(result);
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
    await writePersistedConfig(merged);
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

export type { AppConfig } from '@/utils/configTypes';
