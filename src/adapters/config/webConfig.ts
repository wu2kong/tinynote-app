import type { AppConfig } from '@/utils/configTypes';

const STORAGE_KEY = 'tinynote.config.v1';

export async function loadWebConfig(): Promise<AppConfig | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppConfig;
  } catch {
    return null;
  }
}

export async function saveWebConfig(config: AppConfig): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
