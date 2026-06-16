import { isWeb } from '@/platform/detect';
import { getDefaultStoragePath } from '@/utils/fileSystem';
import { loadConfig, saveConfig } from '@/utils/config';

export async function initializePlatform(): Promise<void> {
  if (!isWeb()) return;

  const config = await loadConfig();
  if (!config.storagePath) {
    await saveConfig({ storagePath: getDefaultStoragePath() });
  }
}

export function getPlatformLabel(): string {
  if (isWeb()) return 'web';
  return 'tauri';
}
