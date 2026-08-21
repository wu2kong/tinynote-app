import { loadConfig, saveConfig } from '@/utils/config';
import {
  addGitRemote,
  gitInit,
  gitPull,
  gitSyncPush,
  listGitRemotes,
  removeGitRemote,
  type SyncAuth,
} from '@/utils/sync';
import {
  authForProvider,
  createLocalId,
  inferGitProvider,
  suggestedRemoteName,
  toHttpsRemoteUrl,
  type GitRemoteProvider,
} from '@/adapters/sync/gitProviders';
import type { AppConfig, GitRemoteConfig } from '@/utils/configTypes';

export function buildAuthByRemote(config: AppConfig): Record<string, SyncAuth> {
  const result: Record<string, SyncAuth> = {};
  for (const remote of config.gitRemotes) {
    const stored = config.gitRemoteAuth[remote.name];
    const token = stored?.token || config.syncAuthToken;
    if (!token) continue;
    result[remote.name] = authForProvider(remote.provider, token, stored?.username);
  }
  return result;
}

export function enabledRemoteNames(config: AppConfig): string[] {
  return config.gitRemotes
    .filter((remote) => remote.enabled !== false && Boolean(remote.url))
    .map((remote) => remote.name);
}

export async function addGitRemotePlaceholder(provider: GitRemoteProvider): Promise<GitRemoteConfig> {
  const config = await loadConfig();
  if (provider !== 'custom') {
    const existing = config.gitRemotes.find((remote) => remote.provider === provider);
    if (existing) return existing;
  }

  const name = suggestedRemoteName(provider, config.gitRemotes.map((remote) => remote.name));
  const remote: GitRemoteConfig = {
    id: createLocalId(),
    name,
    provider,
    url: '',
    enabled: true,
    host: null,
  };

  await saveConfig({
    syncMode: 'git',
    gitRemotes: [...config.gitRemotes, remote],
    syncPrimaryRemote: config.syncPrimaryRemote ?? name,
  });
  return remote;
}

export async function hydrateGitRemotesFromRepo(storagePath: string): Promise<AppConfig> {
  const config = await loadConfig();
  let live: Array<{ name: string; url: string }> = [];
  try {
    live = await listGitRemotes(storagePath);
  } catch {
    return config;
  }

  const byName = new Map(config.gitRemotes.map((remote) => [remote.name, remote]));
  let changed = false;
  const next: GitRemoteConfig[] = config.gitRemotes.map((remote) => ({ ...remote }));

  for (const remote of live) {
    const existing = byName.get(remote.name);
    if (!existing) {
      next.push({
        id: createLocalId(),
        name: remote.name,
        provider: inferGitProvider(remote.url),
        url: remote.url,
        enabled: true,
        host: null,
      });
      changed = true;
    } else if (existing.url !== remote.url) {
      const index = next.findIndex((item) => item.name === remote.name);
      if (index >= 0) next[index] = { ...next[index], url: remote.url };
      changed = true;
    }
  }

  const primary = config.syncPrimaryRemote
    && next.some((remote) => remote.name === config.syncPrimaryRemote)
    ? config.syncPrimaryRemote
    : next[0]?.name ?? null;

  if (!changed && primary === config.syncPrimaryRemote && config.syncMode === 'git') {
    return config;
  }

  return saveConfig({
    gitRemotes: next,
    syncPrimaryRemote: primary,
    syncMode: next.length > 0 || config.syncMode === 'git' ? 'git' : config.syncMode,
  });
}

export async function connectGitRemote(params: {
  storagePath: string;
  provider: GitRemoteProvider;
  name: string;
  url: string;
  token: string;
  username?: string;
  host?: string | null;
}): Promise<void> {
  const url = toHttpsRemoteUrl(params.url);
  await gitInit(params.storagePath);
  await addGitRemote(params.storagePath, params.name, url);

  const config = await loadConfig();
  const remotes = [
    ...config.gitRemotes.filter((remote) => remote.name !== params.name),
    {
      id: config.gitRemotes.find((remote) => remote.name === params.name)?.id ?? createLocalId(),
      name: params.name,
      provider: params.provider,
      url,
      enabled: true,
      host: params.host ?? null,
    },
  ];
  const auth = authForProvider(params.provider, params.token, params.username);
  const gitRemoteAuth = {
    ...config.gitRemoteAuth,
    [params.name]: { username: auth.username, token: params.token.trim() },
  };

  await saveConfig({
    syncMode: 'git',
    gitRemotes: remotes,
    syncPrimaryRemote: config.syncPrimaryRemote ?? params.name,
    gitRemoteAuth,
  });

  const syncAuth = authForProvider(params.provider, params.token, params.username);
  try {
    await gitPull(params.storagePath, {
      remote: params.name,
      auth: syncAuth,
      allowUnrelated: true,
    });
  } catch {
    await gitSyncPush(params.storagePath, {
      remotes: [params.name],
      authByRemote: { [params.name]: syncAuth },
    });
  }
}

export async function disconnectGitRemote(storagePath: string, name: string): Promise<void> {
  try {
    await removeGitRemote(storagePath, name);
  } catch {
    // Remote may already be gone from git config.
  }
  const config = await loadConfig();
  const remotes = config.gitRemotes.filter((remote) => remote.name !== name);
  const gitRemoteAuth = { ...config.gitRemoteAuth };
  delete gitRemoteAuth[name];
  const primary = config.syncPrimaryRemote === name
    ? remotes[0]?.name ?? null
    : config.syncPrimaryRemote;
  await saveConfig({
    gitRemotes: remotes,
    gitRemoteAuth,
    syncPrimaryRemote: primary,
  });
}

export async function saveRemoteAuth(
  name: string,
  provider: GitRemoteProvider,
  token: string,
  username?: string,
): Promise<void> {
  const config = await loadConfig();
  const auth = authForProvider(provider, token, username);
  await saveConfig({
    gitRemoteAuth: {
      ...config.gitRemoteAuth,
      [name]: { username: auth.username, token: token.trim() },
    },
  });
}
