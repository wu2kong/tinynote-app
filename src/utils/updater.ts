import { invoke } from '@tauri-apps/api/core';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import { getVersion } from '@tauri-apps/api/app';
import { GITHUB_RELEASES_API } from '@/constants/app';

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  asset: GitHubReleaseAsset;
}

type Platform = 'windows' | 'macos' | 'linux';

function detectPlatform(): Platform {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac')) return 'macos';
  return 'linux';
}

function parseVersion(version: string): number[] {
  return version.replace(/^v/i, '').split('.').map((part) => Number(part) || 0);
}

export function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = parseVersion(latest);
  const currentParts = parseVersion(current);
  const length = Math.max(latestParts.length, currentParts.length);

  for (let i = 0; i < length; i++) {
    const diff = (latestParts[i] ?? 0) - (currentParts[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

function pickAsset(assets: GitHubReleaseAsset[], platform: Platform): GitHubReleaseAsset | null {
  if (platform === 'windows') {
    return (
      assets.find((a) => /x64-setup\.exe$/i.test(a.name)) ??
      assets.find((a) => /x64.*\.msi$/i.test(a.name)) ??
      null
    );
  }
  if (platform === 'macos') {
    return assets.find((a) => /universal\.dmg$/i.test(a.name)) ?? null;
  }
  return (
    assets.find((a) => /\.AppImage$/i.test(a.name)) ??
    assets.find((a) => /amd64\.deb$/i.test(a.name)) ??
    null
  );
}

function formatNetworkError(message: string): string {
  if (
    message === 'Load failed' ||
    /failed to fetch|networkerror|network error|无法连接|连接失败/i.test(message)
  ) {
    return '网络请求失败，请检查网络连接是否正常';
  }
  return message;
}

export async function getAppVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return '0.0.0';
  }
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const currentVersion = await getAppVersion();
  let response: Response;
  try {
    response = await fetch(GITHUB_RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '检查更新失败';
    throw new Error(formatNetworkError(msg));
  }

  if (!response.ok) {
    throw new Error(`检查更新失败 (${response.status})`);
  }

  const release = await response.json() as {
    tag_name: string;
    html_url: string;
    assets: GitHubReleaseAsset[];
  };

  const latestVersion = release.tag_name.replace(/^v/i, '');
  if (!isNewerVersion(latestVersion, currentVersion)) {
    return null;
  }

  const asset = pickAsset(release.assets, detectPlatform());
  if (!asset) {
    throw new Error('未找到适用于当前平台的安装包');
  }

  return {
    currentVersion,
    latestVersion,
    releaseUrl: release.html_url,
    asset,
  };
}

export async function downloadAndInstall(asset: GitHubReleaseAsset): Promise<void> {
  const filePath = await invoke<string>('download_release_asset', {
    url: asset.browser_download_url,
    filename: asset.name,
  });
  await openPath(filePath);
}

export async function openReleasePage(releaseUrl: string): Promise<void> {
  await openUrl(releaseUrl);
}

export function formatUpdateError(error: unknown, fallback: string): string {
  if (typeof error === 'string') {
    return formatNetworkError(error);
  }
  if (error instanceof Error) {
    return formatNetworkError(error.message);
  }
  return fallback;
}
