import { writeFile } from '@tauri-apps/plugin-fs';
import { tempDir, join } from '@tauri-apps/api/path';
import { openPath } from '@tauri-apps/plugin-opener';
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

export async function getAppVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return '0.0.0';
  }
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const currentVersion = await getAppVersion();
  const response = await fetch(GITHUB_RELEASES_API, {
    headers: { Accept: 'application/vnd.github+json' },
  });

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
  const response = await fetch(asset.browser_download_url);
  if (!response.ok) {
    throw new Error(`下载失败 (${response.status})`);
  }

  const data = new Uint8Array(await response.arrayBuffer());
  const dir = await tempDir();
  const filePath = await join(dir, asset.name);
  await writeFile(filePath, data);
  await openPath(filePath);
}
