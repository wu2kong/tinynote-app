import { getConfig, loadConfig } from '@/utils/config';
import { getSyncBackend } from '@/platform/detect';
import type { SyncRuntimeOptions } from '@/adapters/sync/types';

export async function loadSyncRuntimeOptions(): Promise<SyncRuntimeOptions> {
  const cfg = getConfig().syncRemoteUrl ? getConfig() : await loadConfig();
  const token = cfg.syncAuthToken?.trim();

  return {
    corsProxy: cfg.gitCorsProxy?.trim() || import.meta.env.VITE_GIT_CORS_PROXY || 'https://cors.isomorphic-git.org',
    auth: token
      ? { username: token, password: 'x-oauth-basic' }
      : null,
  };
}

export { getSyncBackend };
