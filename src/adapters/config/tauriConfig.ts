import { readTextFile, writeTextFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import type { AppConfig } from '@/utils/configTypes';

const CONFIG_DIR = '.tinynotes';
const CONFIG_FILE = '.tinynotes/configs.json';
const HOME = BaseDirectory.Home;

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

export async function loadTauriConfig(): Promise<AppConfig | null> {
  try {
    await ensureConfigDir();
    const content = await readTextFile(CONFIG_FILE, { baseDir: HOME });
    return JSON.parse(content) as AppConfig;
  } catch {
    return null;
  }
}

export async function saveTauriConfig(config: AppConfig): Promise<void> {
  await ensureConfigDir();
  await writeTextFile(CONFIG_FILE, JSON.stringify(config, null, 2), { create: true, baseDir: HOME });
}
