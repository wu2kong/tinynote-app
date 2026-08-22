import { gitHttpRequest, parseJsonBody } from './gitHttp';
import type { SyncAuth } from './types';

export type GitRemoteProvider = 'github' | 'gitee' | 'gitlab' | 'codeup' | 'atomgit' | 'tinynote' | 'custom';

export interface GitProviderMeta {
  id: GitRemoteProvider;
  defaultRemoteName: string;
  oauthClientId: string;
  comingSoon?: boolean;
}

export interface GitProviderUser {
  login: string;
  name: string | null;
  organizationId?: string | null;
}

export interface GitProviderRepo {
  fullName: string;
  name: string;
  url: string;
  private: boolean;
  defaultBranch: string;
}

export interface GitDeviceAuthStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresIn: number;
}

const GITHUB_CLIENT_ID = (import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID ?? '').trim();
const GITEE_CLIENT_ID = (import.meta.env.VITE_GITEE_OAUTH_CLIENT_ID ?? '').trim();
const GITLAB_CLIENT_ID = (import.meta.env.VITE_GITLAB_OAUTH_CLIENT_ID ?? '').trim();
const TINYNOTE_CLIENT_ID = (import.meta.env.VITE_TINYNOTE_GIT_OAUTH_CLIENT_ID ?? '').trim();

export const TINYNOTE_GIT_HOST = (import.meta.env.VITE_TINYNOTE_GIT_HOST ?? 'https://git.wu2kong.com').replace(/\/+$/, '');
const CODEUP_API_HOST = 'https://openapi-rdc.aliyuncs.com';
const CODEUP_GIT_HOST = 'https://codeup.aliyun.com';

export const GIT_PROVIDERS: GitProviderMeta[] = [
  { id: 'tinynote', defaultRemoteName: 'tinynote', oauthClientId: TINYNOTE_CLIENT_ID },
  { id: 'github', defaultRemoteName: 'github', oauthClientId: GITHUB_CLIENT_ID },
  { id: 'gitee', defaultRemoteName: 'gitee', oauthClientId: GITEE_CLIENT_ID },
  { id: 'gitlab', defaultRemoteName: 'gitlab', oauthClientId: GITLAB_CLIENT_ID },
  { id: 'codeup', defaultRemoteName: 'codeup', oauthClientId: '' },
  { id: 'atomgit', defaultRemoteName: 'atomgit', oauthClientId: '' },
  { id: 'custom', defaultRemoteName: 'origin', oauthClientId: '' },
];

export function getGitProvider(id: GitRemoteProvider): GitProviderMeta {
  return GIT_PROVIDERS.find((item) => item.id === id) ?? GIT_PROVIDERS[GIT_PROVIDERS.length - 1];
}

export function normalizeGitHost(host: string | null | undefined, fallback: string): string {
  const raw = (host ?? '').trim() || fallback;
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, '');
  }
  return `https://${raw.replace(/\/+$/, '')}`;
}

export function inferGitProvider(url: string): GitRemoteProvider {
  const value = url.trim().toLowerCase();
  if (!value) return 'custom';
  if (value.includes('github.com')) return 'github';
  if (value.includes('gitee.com')) return 'gitee';
  if (value.includes('codeup.aliyun.com') || value.includes('codeup.aliyun')) return 'codeup';
  if (value.includes('gitcode.com') || value.includes('atomgit.com')) return 'atomgit';
  if (value.includes('gitlab.com') || /gitlab\./.test(value)) return 'gitlab';
  if (
    value.includes('tinynote')
    || value.includes('git.wu2kong.com')
    || value.includes(TINYNOTE_GIT_HOST.replace(/^https?:\/\//, '').toLowerCase())
  ) {
    return 'tinynote';
  }
  return 'custom';
}

export function toHttpsRemoteUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const sshHost = trimmed.match(/^git@([^:]+):(.+)$/);
  if (sshHost) {
    return `https://${sshHost[1]}/${sshHost[2].replace(/^\/+/, '')}`;
  }
  const sshUrl = trimmed.match(/^ssh:\/\/(?:git@)?([^/]+)\/(.+)$/);
  if (sshUrl) {
    return `https://${sshUrl[1]}/${sshUrl[2]}`;
  }
  return trimmed;
}

export function suggestedRemoteName(provider: GitRemoteProvider, existing: string[]): string {
  const base = getGitProvider(provider).defaultRemoteName;
  if (!existing.includes(base)) return base;
  let index = 2;
  while (existing.includes(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

export function tokenCreateUrl(provider: GitRemoteProvider, host?: string): string {
  switch (provider) {
    case 'github':
      return 'https://github.com/settings/tokens/new?scopes=repo&description=TinyNote';
    case 'gitee':
      return 'https://gitee.com/personal_access_tokens';
    case 'gitlab':
      return `${normalizeGitHost(host, 'https://gitlab.com')}/-/user_settings/personal_access_tokens?name=TinyNote&scopes=api,write_repository`;
    case 'codeup':
      return 'https://account-devops.aliyun.com/settings/personalAccessTokenCreate';
    case 'atomgit':
      return 'https://gitcode.com/setting/token-classic/create';
    case 'tinynote':
      return `${normalizeGitHost(host, TINYNOTE_GIT_HOST)}/user/settings/applications`;
    default:
      return '';
  }
}

export function authForProvider(provider: GitRemoteProvider, token: string, username?: string): SyncAuth {
  const trimmedToken = token.trim();
  switch (provider) {
    case 'github':
      return { username: 'x-access-token', password: trimmedToken };
    case 'gitee':
      return { username: 'oauth2', password: trimmedToken };
    case 'gitlab':
      return { username: 'oauth2', password: trimmedToken };
    case 'codeup':
      return { username: username?.trim() || 'oauth2', password: trimmedToken };
    case 'atomgit':
      return { username: username?.trim() || 'oauth2', password: trimmedToken };
    case 'tinynote':
      return { username: username?.trim() || 'oauth2', password: trimmedToken };
    default:
      return { username: username?.trim() || 'git', password: trimmedToken };
  }
}

function formBody(data: Record<string, string>): string {
  return Object.entries(data)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function assertOk(status: number, text: string, fallback: string): void {
  if (status >= 200 && status < 300) return;
  let detail = fallback;
  try {
    const parsed = parseJsonBody<{
      message?: string;
      error_description?: string;
      error?: string;
      errorMessage?: string;
    }>(text);
    detail = parsed.message || parsed.error_description || parsed.error || parsed.errorMessage || fallback;
  } catch {
    if (text.trim()) detail = text.trim().slice(0, 240);
  }
  if (status === 401 || status === 403) {
    throw new Error(detail || fallback);
  }
  throw new Error(detail);
}

function giteaHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/json',
    Authorization: `token ${token.trim()}`,
  };
}

function giteaCloneUrl(repo: {
  clone_url?: string;
  html_url?: string;
  full_name?: string;
}, host: string): string {
  if (repo.clone_url?.trim()) return repo.clone_url.trim();
  const web = (repo.html_url ?? '').replace(/\/+$/, '');
  if (web) return web.endsWith('.git') ? web : `${web}.git`;
  if (repo.full_name) return `${host}/${repo.full_name.replace(/^\/+/, '')}.git`;
  return '';
}

function gitcodeCloneUrl(repo: {
  http_url_to_repo?: string;
  clone_url?: string;
  html_url?: string;
  web_url?: string;
  full_name?: string;
}): string {
  if (repo.http_url_to_repo?.trim()) return repo.http_url_to_repo.trim();
  if (repo.clone_url?.trim()) return repo.clone_url.trim();
  const web = (repo.html_url || repo.web_url || '').replace(/\/+$/, '');
  if (web) return web.endsWith('.git') ? web : `${web}.git`;
  if (repo.full_name) return `https://gitcode.com/${repo.full_name.replace(/^\/+/, '')}.git`;
  return '';
}

function yunxiaoHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-yunxiao-token': token.trim(),
  };
}

function asObjectList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { result?: unknown }).result)) {
    return (data as { result: T[] }).result;
  }
  return [];
}

function codeupCloneUrl(repo: {
  httpUrlToRepo?: string;
  webUrl?: string;
  pathWithNamespace?: string;
}): string {
  if (repo.httpUrlToRepo?.trim()) return repo.httpUrlToRepo.trim();
  const web = (repo.webUrl ?? '').replace(/\/+$/, '');
  if (web) return web.endsWith('.git') ? web : `${web}.git`;
  if (repo.pathWithNamespace) return `${CODEUP_GIT_HOST}/${repo.pathWithNamespace.replace(/^\/+/, '')}.git`;
  return '';
}

async function yunxiaoGet<T>(path: string, token: string): Promise<{ status: number; data: T; text: string }> {
  const response = await gitHttpRequest({
    method: 'GET',
    url: `${CODEUP_API_HOST}${path}`,
    headers: yunxiaoHeaders(token),
  });
  return { status: response.status, data: parseJsonBody<T>(response.text), text: response.text };
}

async function listCodeupOrganizations(token: string): Promise<Array<{ id?: string; name?: string }>> {
  const response = await yunxiaoGet<unknown>('/oapi/v1/platform/organizations?page=1&perPage=100', token);
  assertOk(response.status, response.text, 'Codeup authorization failed');
  return asObjectList<{ id?: string; name?: string }>(response.data).filter((item) => item.id);
}

async function listCodeupOrgRepos(
  token: string,
  organizationId: string | null,
): Promise<GitProviderRepo[]> {
  const repos: GitProviderRepo[] = [];
  const base = organizationId
    ? `/oapi/v1/codeup/organizations/${encodeURIComponent(organizationId)}/repositories`
    : '/oapi/v1/codeup/repositories';
  for (let page = 1; page <= 5; page += 1) {
    const response = await yunxiaoGet<unknown>(
      `${base}?page=${page}&perPage=100&orderBy=last_activity_at&sort=desc&archived=false`,
      token,
    );
    assertOk(response.status, response.text, 'Failed to list Codeup repositories');
    const batch = asObjectList<{
      name?: string;
      path?: string;
      pathWithNamespace?: string;
      webUrl?: string;
      httpUrlToRepo?: string;
      visibility?: string;
      defaultBranch?: string;
    }>(response.data);
    for (const repo of batch) {
      const url = codeupCloneUrl(repo);
      if (!url) continue;
      repos.push({
        fullName: repo.pathWithNamespace || repo.name || repo.path || url,
        name: repo.name || repo.path || '',
        url,
        private: repo.visibility !== 'internal',
        defaultBranch: repo.defaultBranch || 'master',
      });
    }
    if (batch.length < 100) break;
  }
  return repos;
}

async function codeupHttpsCloneUsername(
  token: string,
  organizationId: string | null | undefined,
  userId: string,
): Promise<string | null> {
  if (!userId) return null;
  const path = organizationId
    ? `/oapi/v1/codeup/organizations/${encodeURIComponent(organizationId)}/users/${encodeURIComponent(userId)}/httpsCloneUsername`
    : `/oapi/v1/codeup/users/${encodeURIComponent(userId)}/httpsCloneUsername`;
  try {
    const response = await yunxiaoGet<{ httpsCloneUsername?: string }>(path, token);
    if (response.status >= 200 && response.status < 300 && response.data.httpsCloneUsername) {
      return response.data.httpsCloneUsername;
    }
  } catch {
    return null;
  }
  return null;
}

export async function verifyGitToken(
  provider: GitRemoteProvider,
  token: string,
  host?: string,
): Promise<GitProviderUser> {
  if (provider === 'custom') {
    const login = token.trim() ? 'ok' : '';
    if (!login) throw new Error('empty token');
    return { login: host || 'git', name: null };
  }

  if (provider === 'tinynote') {
    const giteaHost = normalizeGitHost(host, TINYNOTE_GIT_HOST);
    const response = await gitHttpRequest({
      method: 'GET',
      url: `${giteaHost}/api/v1/user`,
      headers: giteaHeaders(token),
    });
    assertOk(response.status, response.text, 'TinyNote official authorization failed');
    const data = parseJsonBody<{ login?: string; username?: string; full_name?: string | null }>(response.text);
    const login = data.login || data.username;
    if (!login) throw new Error('TinyNote official authorization failed');
    return { login, name: data.full_name ?? null };
  }

  if (provider === 'github') {
    const response = await gitHttpRequest({
      method: 'GET',
      url: 'https://api.github.com/user',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token.trim()}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    assertOk(response.status, response.text, 'GitHub authorization failed');
    const data = parseJsonBody<{ login?: string; name?: string | null }>(response.text);
    if (!data.login) throw new Error('GitHub authorization failed');
    return { login: data.login, name: data.name ?? null };
  }

  if (provider === 'gitee') {
    const response = await gitHttpRequest({
      method: 'GET',
      url: `https://gitee.com/api/v5/user?access_token=${encodeURIComponent(token.trim())}`,
    });
    assertOk(response.status, response.text, 'Gitee authorization failed');
    const data = parseJsonBody<{ login?: string; name?: string | null }>(response.text);
    if (!data.login) throw new Error('Gitee authorization failed');
    return { login: data.login, name: data.name ?? null };
  }

  if (provider === 'codeup') {
    const response = await yunxiaoGet<{
      id?: string;
      name?: string | null;
      username?: string;
      lastOrganization?: string;
    }>('/oapi/v1/platform/user', token);
    assertOk(response.status, response.text, 'Codeup authorization failed');
    const data = response.data;
    if (!data.id && !data.username && !data.name) throw new Error('Codeup authorization failed');
    const organizationId = (host || '').trim() || data.lastOrganization || null;
    const cloneUsername = await codeupHttpsCloneUsername(token, organizationId, data.id || '');
    return {
      login: cloneUsername || data.username || data.name || 'codeup',
      name: data.name ?? null,
      organizationId,
    };
  }

  if (provider === 'atomgit') {
    const response = await gitHttpRequest({
      method: 'GET',
      url: `https://api.gitcode.com/api/v5/user?access_token=${encodeURIComponent(token.trim())}`,
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    assertOk(response.status, response.text, 'AtomGit authorization failed');
    const data = parseJsonBody<{ login?: string; name?: string | null }>(response.text);
    if (!data.login) throw new Error('AtomGit authorization failed');
    return { login: data.login, name: data.name ?? null };
  }

  const gitlabHost = normalizeGitHost(host, 'https://gitlab.com');
  const response = await gitHttpRequest({
    method: 'GET',
    url: `${gitlabHost}/api/v4/user`,
    headers: { Authorization: `Bearer ${token.trim()}` },
  });
  assertOk(response.status, response.text, 'GitLab authorization failed');
  const data = parseJsonBody<{ username?: string; name?: string | null }>(response.text);
  if (!data.username) throw new Error('GitLab authorization failed');
  return { login: data.username, name: data.name ?? null };
}

export async function listProviderRepos(
  provider: GitRemoteProvider,
  token: string,
  host?: string,
): Promise<GitProviderRepo[]> {
  if (provider === 'github') {
    const response = await gitHttpRequest({
      method: 'GET',
      url: 'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token.trim()}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    assertOk(response.status, response.text, 'Failed to list GitHub repositories');
    const data = parseJsonBody<Array<{
      full_name?: string;
      name?: string;
      clone_url?: string;
      private?: boolean;
      default_branch?: string;
    }>>(response.text);
    return (Array.isArray(data) ? data : []).map((repo) => ({
      fullName: repo.full_name || repo.name || '',
      name: repo.name || '',
      url: repo.clone_url || '',
      private: Boolean(repo.private),
      defaultBranch: repo.default_branch || 'main',
    })).filter((repo) => repo.url);
  }

  if (provider === 'gitee') {
    const response = await gitHttpRequest({
      method: 'GET',
      url: `https://gitee.com/api/v5/user/repos?access_token=${encodeURIComponent(token.trim())}&sort=updated&per_page=100`,
    });
    assertOk(response.status, response.text, 'Failed to list Gitee repositories');
    const data = parseJsonBody<Array<{
      full_name?: string;
      name?: string;
      html_url?: string;
      private?: boolean;
      default_branch?: string;
    }>>(response.text);
    return (Array.isArray(data) ? data : []).map((repo) => ({
      fullName: repo.full_name || repo.name || '',
      name: repo.name || '',
      url: repo.html_url ? `${repo.html_url.replace(/\/+$/, '')}.git` : '',
      private: Boolean(repo.private),
      defaultBranch: repo.default_branch || 'master',
    })).filter((repo) => repo.url);
  }

  if (provider === 'atomgit') {
    const response = await gitHttpRequest({
      method: 'GET',
      url: `https://api.gitcode.com/api/v5/user/repos?access_token=${encodeURIComponent(token.trim())}&sort=updated&per_page=100&affiliation=${encodeURIComponent('owner,collaborator')}`,
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    assertOk(response.status, response.text, 'Failed to list AtomGit repositories');
    const data = parseJsonBody<Array<{
      full_name?: string;
      name?: string;
      html_url?: string;
      web_url?: string;
      http_url_to_repo?: string;
      clone_url?: string;
      private?: boolean;
      visibility?: string;
      default_branch?: string;
    }>>(response.text);
    return (Array.isArray(data) ? data : []).map((repo) => ({
      fullName: repo.full_name || repo.name || '',
      name: repo.name || '',
      url: gitcodeCloneUrl(repo),
      private: repo.private !== false && repo.visibility !== 'public',
      defaultBranch: repo.default_branch || 'main',
    })).filter((repo) => repo.url);
  }

  if (provider === 'gitlab') {
    const gitlabHost = normalizeGitHost(host, 'https://gitlab.com');
    const response = await gitHttpRequest({
      method: 'GET',
      url: `${gitlabHost}/api/v4/projects?membership=true&simple=true&order_by=last_activity_at&per_page=100`,
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    assertOk(response.status, response.text, 'Failed to list GitLab projects');
    const data = parseJsonBody<Array<{
      path_with_namespace?: string;
      name?: string;
      http_url_to_repo?: string;
      visibility?: string;
      default_branch?: string;
    }>>(response.text);
    return (Array.isArray(data) ? data : []).map((repo) => ({
      fullName: repo.path_with_namespace || repo.name || '',
      name: repo.name || '',
      url: repo.http_url_to_repo || '',
      private: repo.visibility !== 'public',
      defaultBranch: repo.default_branch || 'main',
    })).filter((repo) => repo.url);
  }

  if (provider === 'codeup') {
    const orgs = host?.trim()
      ? [{ id: host.trim() }]
      : await listCodeupOrganizations(token);
    if (orgs.length === 0) {
      return listCodeupOrgRepos(token, null);
    }
    const listed: GitProviderRepo[] = [];
    const seen = new Set<string>();
    for (const org of orgs) {
      if (!org.id) continue;
      const repos = await listCodeupOrgRepos(token, org.id);
      for (const repo of repos) {
        if (seen.has(repo.url)) continue;
        seen.add(repo.url);
        listed.push(repo);
      }
    }
    return listed;
  }

  if (provider === 'tinynote') {
    const giteaHost = normalizeGitHost(host, TINYNOTE_GIT_HOST);
    const repos: GitProviderRepo[] = [];
    for (let page = 1; page <= 5; page += 1) {
      const response = await gitHttpRequest({
        method: 'GET',
        url: `${giteaHost}/api/v1/user/repos?limit=100&page=${page}`,
        headers: giteaHeaders(token),
      });
      assertOk(response.status, response.text, 'Failed to list TinyNote official repositories');
      const batch = parseJsonBody<Array<{
        full_name?: string;
        name?: string;
        clone_url?: string;
        html_url?: string;
        private?: boolean;
        default_branch?: string;
      }>>(response.text);
      const items = Array.isArray(batch) ? batch : [];
      for (const repo of items) {
        const url = giteaCloneUrl(repo, giteaHost);
        if (!url) continue;
        repos.push({
          fullName: repo.full_name || repo.name || '',
          name: repo.name || '',
          url,
          private: Boolean(repo.private),
          defaultBranch: repo.default_branch || 'main',
        });
      }
      if (items.length < 100) break;
    }
    return repos;
  }

  return [];
}

export async function createProviderRepo(
  provider: GitRemoteProvider,
  token: string,
  name: string,
  options?: { privateRepo?: boolean; host?: string },
): Promise<GitProviderRepo> {
  const privateRepo = options?.privateRepo !== false;
  const repoName = name.trim().replace(/\s+/g, '-');
  if (!repoName) throw new Error('Repository name is required');

  if (provider === 'github') {
    const response = await gitHttpRequest({
      method: 'POST',
      url: 'https://api.github.com/user/repos',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token.trim()}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        name: repoName,
        private: privateRepo,
        auto_init: false,
        description: 'TinyNote library',
      }),
    });
    assertOk(response.status, response.text, 'Failed to create GitHub repository');
    const data = parseJsonBody<{
      full_name?: string;
      name?: string;
      clone_url?: string;
      private?: boolean;
      default_branch?: string;
    }>(response.text);
    if (!data.clone_url) throw new Error('Failed to create GitHub repository');
    return {
      fullName: data.full_name || repoName,
      name: data.name || repoName,
      url: data.clone_url,
      private: Boolean(data.private),
      defaultBranch: data.default_branch || 'main',
    };
  }

  if (provider === 'gitee') {
    const response = await gitHttpRequest({
      method: 'POST',
      url: 'https://gitee.com/api/v5/user/repos',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: token.trim(),
        name: repoName,
        private: privateRepo,
        auto_init: false,
        description: 'TinyNote library',
      }),
    });
    assertOk(response.status, response.text, 'Failed to create Gitee repository');
    const data = parseJsonBody<{
      full_name?: string;
      name?: string;
      html_url?: string;
      private?: boolean;
      default_branch?: string;
    }>(response.text);
    const url = data.html_url ? `${data.html_url.replace(/\/+$/, '')}.git` : '';
    if (!url) throw new Error('Failed to create Gitee repository');
    return {
      fullName: data.full_name || repoName,
      name: data.name || repoName,
      url,
      private: Boolean(data.private),
      defaultBranch: data.default_branch || 'master',
    };
  }

  if (provider === 'atomgit') {
    const response = await gitHttpRequest({
      method: 'POST',
      url: `https://api.gitcode.com/api/v5/user/repos?access_token=${encodeURIComponent(token.trim())}`,
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        private: privateRepo,
        auto_init: false,
        description: 'TinyNote library',
      }),
    });
    assertOk(response.status, response.text, 'Failed to create AtomGit repository');
    const data = parseJsonBody<{
      full_name?: string;
      name?: string;
      html_url?: string;
      web_url?: string;
      http_url_to_repo?: string;
      clone_url?: string;
      private?: boolean;
      visibility?: string;
      default_branch?: string;
    }>(response.text);
    const url = gitcodeCloneUrl(data);
    if (!url) throw new Error('Failed to create AtomGit repository');
    return {
      fullName: data.full_name || data.name || repoName,
      name: data.name || repoName,
      url,
      private: data.private !== false && data.visibility !== 'public',
      defaultBranch: data.default_branch || 'main',
    };
  }

  if (provider === 'gitlab') {
    const gitlabHost = normalizeGitHost(options?.host, 'https://gitlab.com');
    const response = await gitHttpRequest({
      method: 'POST',
      url: `${gitlabHost}/api/v4/projects`,
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        visibility: privateRepo ? 'private' : 'public',
      }),
    });
    assertOk(response.status, response.text, 'Failed to create GitLab project');
    const data = parseJsonBody<{
      path_with_namespace?: string;
      name?: string;
      http_url_to_repo?: string;
      visibility?: string;
      default_branch?: string;
    }>(response.text);
    if (!data.http_url_to_repo) throw new Error('Failed to create GitLab project');
    return {
      fullName: data.path_with_namespace || repoName,
      name: data.name || repoName,
      url: data.http_url_to_repo,
      private: data.visibility !== 'public',
      defaultBranch: data.default_branch || 'main',
    };
  }

  if (provider === 'codeup') {
    let organizationId = (options?.host ?? '').trim();
    if (!organizationId) {
      const user = await verifyGitToken('codeup', token);
      organizationId = user.organizationId?.trim() || '';
    }
    if (!organizationId) {
      const orgs = await listCodeupOrganizations(token);
      organizationId = orgs[0]?.id || '';
    }
    if (!organizationId) throw new Error('Codeup organization is required');
    const path = `/oapi/v1/codeup/organizations/${encodeURIComponent(organizationId)}/repositories`;
    const response = await gitHttpRequest({
      method: 'POST',
      url: `${CODEUP_API_HOST}${path}`,
      headers: yunxiaoHeaders(token),
      body: JSON.stringify({
        name: repoName,
        path: repoName,
        description: 'TinyNote library',
        readMeType: 'EMPTY',
        visibility: privateRepo ? 'private' : 'internal',
      }),
    });
    assertOk(response.status, response.text, 'Failed to create Codeup repository');
    const created = parseJsonBody<{
      id?: number | string;
      name?: string;
      path?: string;
      pathWithNamespace?: string;
      webUrl?: string;
      httpUrlToRepo?: string;
      visibility?: string;
      defaultBranch?: string;
    }>(response.text);
    let url = codeupCloneUrl(created);
    if (!url && created.id != null) {
      const detail = await yunxiaoGet<{
        httpUrlToRepo?: string;
        webUrl?: string;
        pathWithNamespace?: string;
        name?: string;
        visibility?: string;
        defaultBranch?: string;
      }>(
        `/oapi/v1/codeup/organizations/${encodeURIComponent(organizationId)}/repositories/${encodeURIComponent(String(created.id))}`,
        token,
      );
      if (detail.status >= 200 && detail.status < 300) {
        url = codeupCloneUrl(detail.data);
      }
    }
    if (!url) throw new Error('Failed to create Codeup repository');
    return {
      fullName: created.pathWithNamespace || created.name || repoName,
      name: created.name || repoName,
      url,
      private: created.visibility !== 'internal',
      defaultBranch: created.defaultBranch || 'master',
    };
  }

  if (provider === 'tinynote') {
    const giteaHost = normalizeGitHost(options?.host, TINYNOTE_GIT_HOST);
    const response = await gitHttpRequest({
      method: 'POST',
      url: `${giteaHost}/api/v1/user/repos`,
      headers: {
        ...giteaHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        private: privateRepo,
        auto_init: false,
        description: 'TinyNote library',
      }),
    });
    assertOk(response.status, response.text, 'Failed to create TinyNote official repository');
    const data = parseJsonBody<{
      full_name?: string;
      name?: string;
      clone_url?: string;
      html_url?: string;
      private?: boolean;
      default_branch?: string;
    }>(response.text);
    const url = giteaCloneUrl(data, giteaHost);
    if (!url) throw new Error('Failed to create TinyNote official repository');
    return {
      fullName: data.full_name || data.name || repoName,
      name: data.name || repoName,
      url,
      private: Boolean(data.private),
      defaultBranch: data.default_branch || 'main',
    };
  }

  throw new Error('This platform cannot create repositories from TinyNote');
}

export function supportsOAuth(provider: GitRemoteProvider): boolean {
  const meta = getGitProvider(provider);
  return Boolean(meta.oauthClientId) && (provider === 'github' || provider === 'gitlab');
}

export async function startDeviceAuth(
  provider: GitRemoteProvider,
  host?: string,
): Promise<GitDeviceAuthStart> {
  if (provider === 'github') {
    const response = await gitHttpRequest({
      method: 'POST',
      url: 'https://github.com/login/device/code',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody({ client_id: GITHUB_CLIENT_ID, scope: 'repo' }),
    });
    assertOk(response.status, response.text, 'GitHub login failed');
    const data = parseJsonBody<{
      device_code?: string;
      user_code?: string;
      verification_uri?: string;
      interval?: number;
      expires_in?: number;
    }>(response.text);
    if (!data.device_code || !data.user_code || !data.verification_uri) {
      throw new Error('GitHub login failed');
    }
    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      interval: data.interval || 5,
      expiresIn: data.expires_in || 900,
    };
  }

  if (provider === 'gitlab') {
    const gitlabHost = normalizeGitHost(host, 'https://gitlab.com');
    const response = await gitHttpRequest({
      method: 'POST',
      url: `${gitlabHost}/oauth/authorize_device`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({ client_id: GITLAB_CLIENT_ID, scope: 'api write_repository' }),
    });
    assertOk(response.status, response.text, 'GitLab login failed');
    const data = parseJsonBody<{
      device_code?: string;
      user_code?: string;
      verification_uri?: string;
      interval?: number;
      expires_in?: number;
    }>(response.text);
    if (!data.device_code || !data.user_code || !data.verification_uri) {
      throw new Error('GitLab login failed');
    }
    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      interval: data.interval || 5,
      expiresIn: data.expires_in || 300,
    };
  }

  throw new Error('This platform does not support one-click login yet');
}

export async function pollDeviceAuth(
  provider: GitRemoteProvider,
  deviceCode: string,
  host?: string,
): Promise<{ pending: boolean; token?: string; error?: string }> {
  if (provider === 'github') {
    const response = await gitHttpRequest({
      method: 'POST',
      url: 'https://github.com/login/oauth/access_token',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const data = parseJsonBody<{ access_token?: string; error?: string; error_description?: string }>(response.text);
    if (data.access_token) return { pending: false, token: data.access_token };
    if (data.error === 'authorization_pending' || data.error === 'slow_down') {
      return { pending: true };
    }
    return { pending: false, error: data.error_description || data.error || 'GitHub login failed' };
  }

  if (provider === 'gitlab') {
    const gitlabHost = normalizeGitHost(host, 'https://gitlab.com');
    const response = await gitHttpRequest({
      method: 'POST',
      url: `${gitlabHost}/oauth/token`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        client_id: GITLAB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const data = parseJsonBody<{ access_token?: string; error?: string; error_description?: string }>(response.text);
    if (data.access_token) return { pending: false, token: data.access_token };
    if (data.error === 'authorization_pending' || data.error === 'slow_down') {
      return { pending: true };
    }
    return { pending: false, error: data.error_description || data.error || 'GitLab login failed' };
  }

  return { pending: false, error: 'This platform does not support one-click login yet' };
}

export function createLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
