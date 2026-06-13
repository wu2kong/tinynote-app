import { invoke } from '@tauri-apps/api/core';
import { homeDir, join } from '@tauri-apps/api/path';
import { normalizePath } from './path';


const CONFIG_RELATIVE = '.tinynotes/configs.json';


export async function getConfigFilePath(): Promise<string> {
  const home = await homeDir();
  const path = await join(home, CONFIG_RELATIVE);
  return normalizePath(path);
}

export async function getAppDirectory(): Promise<string> {
  const dir = await invoke<string>('get_app_dir');
  return normalizePath(dir);
}
