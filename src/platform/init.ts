import { isWeb } from '@/platform/detect';
import { getDefaultStoragePath } from '@/utils/fileSystem';
import { bootstrapApplication, prepareWorkspace } from '@/utils/config';

export async function initializePlatform(): Promise<void> {
  if (isWeb()) {
    const workspacePath = await bootstrapApplication();
    if (!workspacePath) {
      await prepareWorkspace(getDefaultStoragePath());
    }
    return;
  }

  await bootstrapApplication();
}

export function getPlatformLabel(): string {
  if (isWeb()) return 'web';
  return 'tauri';
}
