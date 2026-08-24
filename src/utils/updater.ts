import { invoke } from '@tauri-apps/api/core';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import { getVersion } from '@tauri-apps/api/app';
import { GITHUB_APPCAST_URL, GITHUB_RELEASES_API, QINIU_APPCAST_URL, QINIU_LATEST_JSON_URL } from '@/constants/app';
import { isTauri } from '@/platform/detect';
import { t } from '@/i18n';
import { forcedUpdateSource, updateSourceOrder } from '@/utils/updateSource';
import { IS_MAC_APP_STORE } from '@/constants/distribution';

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

export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Mac|Macintosh/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua);
}

export function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Win/i.test(navigator.userAgent);
}

function detectPlatform(): Platform {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac')) return 'macos';
  return 'linux';
}

/** macOS 正式包走 Sparkle 原生对话框；dev / 非 macOS 返回 false。 */
export async function checkWithSparkle(): Promise<boolean> {
  if (IS_MAC_APP_STORE || !isTauri() || !isMacOS()) return false;
  try {
    const sparkle = await import('tauri-plugin-sparkle-updater-api');
    if (!(await sparkle.canCheckForUpdates())) return false;
    const url = await resolveAppcastUrl();
    try {
      await sparkle.setFeedUrl(url);
    } catch {
      if (url === QINIU_APPCAST_URL) return false;
    }
    await sparkle.checkForUpdates();
    return true;
  } catch {
    return false;
  }
}

/** Windows 正式包走 WinSparkle 原生对话框；未初始化时返回 false。 */
export async function checkWithWinSparkle(): Promise<boolean> {
  if (!isTauri() || !isWindows()) return false;
  try {
    const available = await invoke<boolean>('winsparkle_available');
    if (!available) return false;
    const url = await resolveAppcastUrl();
    try {
      await invoke('winsparkle_set_appcast_url', { url });
    } catch {
      if (url === QINIU_APPCAST_URL) return false;
    }
    await invoke('winsparkle_check_for_updates');
    return true;
  } catch {
    return false;
  }
}

export async function checkWithNativeUpdater(): Promise<boolean> {
  if (IS_MAC_APP_STORE) return false;
  if (await checkWithSparkle()) return true;
  return checkWithWinSparkle();
}

async function resolveAppcastUrl(): Promise<string> {
  if (forcedUpdateSource() === 'qiniu') return QINIU_APPCAST_URL;
  if (forcedUpdateSource() === 'github') return GITHUB_APPCAST_URL;
  if (isTauri()) {
    try {
      return await invoke<string>('resolve_appcast_url');
    } catch {
      return GITHUB_APPCAST_URL;
    }
  }
  return GITHUB_APPCAST_URL;
}

/** Probe GitHub first; only switch Sparkle / WinSparkle to Qiniu when GitHub is unreachable. */
export async function configureNativeUpdaterFeed(): Promise<void> {
  if (IS_MAC_APP_STORE || !isTauri()) return;
  const url = await resolveAppcastUrl();
  if (isMacOS()) {
    try {
      const sparkle = await import('tauri-plugin-sparkle-updater-api');
      await sparkle.setFeedUrl(url);
    } catch {
      // Dev builds and older Sparkle plugins may not expose setFeedUrl.
    }
  }
  if (isWindows()) {
    try {
      await invoke('winsparkle_set_appcast_url', { url });
    } catch {
      // WinSparkle is only initialized in release Windows builds.
    }
  }
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
    assets.find((a) => /amd64\.deb$/i.test(a.name)) ??
    assets.find((a) => /\.rpm$/i.test(a.name)) ??
    null
  );
}

function formatNetworkError(message: string): string {
  if (
    message === 'Load failed' ||
    /failed to fetch|networkerror|network error|无法连接|连接失败/i.test(message)
  ) {
    return t('utils.updater.networkFailed');
  }
  return message;
}

export async function getAppVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return t('utils.updater.fallbackVersion');
  }
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (IS_MAC_APP_STORE) return null;
  const currentVersion = await getAppVersion();
  const release = await loadLatestRelease();
  const latestVersion = release.tag_name.replace(/^v/i, '');
  if (!isNewerVersion(latestVersion, currentVersion)) {
    return null;
  }

  const asset = pickAsset(release.assets, detectPlatform());
  if (!asset) {
    throw new Error(t('utils.updater.noAsset'));
  }

  return {
    currentVersion,
    latestVersion,
    releaseUrl: release.html_url,
    asset,
  };
}

interface LatestReleasePayload {
  tag_name: string;
  html_url: string;
  assets: GitHubReleaseAsset[];
}

async function fetchJsonRelease(url: string): Promise<LatestReleasePayload> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : t('utils.updater.checkFailed');
    throw new Error(formatNetworkError(msg));
  }
  if (!response.ok) {
    throw new Error(t('utils.updater.checkFailedWithStatus', { status: response.status }));
  }
  return await response.json() as LatestReleasePayload;
}

async function loadLatestRelease(): Promise<LatestReleasePayload> {
  if (isTauri()) {
    return invoke<LatestReleasePayload>('fetch_latest_release');
  }

  const sources = updateSourceOrder(
    GITHUB_RELEASES_API,
    QINIU_LATEST_JSON_URL,
    forcedUpdateSource(),
  );
  let lastError: Error | null = null;
  for (const url of sources) {
    try {
      return await fetchJsonRelease(url);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error(t('utils.updater.checkFailed'));
}

export async function downloadAndInstall(asset: GitHubReleaseAsset): Promise<void> {
  if (IS_MAC_APP_STORE) {
    throw new Error('Mac App Store 版本由 App Store 提供更新');
  }
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
