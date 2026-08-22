/** Shared TinyNote update-source helpers. Keep in sync with src/utils/updateSource.ts. */

export const GITHUB_REPO = 'wu2kong/tinynote-app';
export const QINIU_CDN_BASE = 'https://qin.wu2kong.com/tinynote';
export const QINIU_APPCAST_PATH = '/updates/appcast.xml';
export const QINIU_LATEST_JSON_PATH = '/updates/latest.json';

export function normalizeCdnBase(base) {
  let value = String(base || QINIU_CDN_BASE).replace(/\/+$/, '');
  if (!value.toLowerCase().includes('/tinynote')) {
    value = `${value}/tinynote`;
  }
  return value;
}

export function qiniuPathPrefix(cdnBase = QINIU_CDN_BASE) {
  return normalizeCdnBase(cdnBase).replace(/^https?:\/\/[^/]+\//i, '').replace(/\/+$/, '');
}

export function qiniuAppcastUrl(cdnBase = QINIU_CDN_BASE) {
  return `${normalizeCdnBase(cdnBase)}${QINIU_APPCAST_PATH}`;
}

export function qiniuLatestJsonUrl(cdnBase = QINIU_CDN_BASE) {
  return `${normalizeCdnBase(cdnBase)}${QINIU_LATEST_JSON_PATH}`;
}

export function githubAppcastUrl(repo = GITHUB_REPO) {
  return `https://github.com/${repo}/releases/latest/download/appcast.xml`;
}

export function githubAssetUrl(tag, filename, repo = GITHUB_REPO) {
  return `https://github.com/${repo}/releases/download/${tag}/${filename}`;
}

export function qiniuAssetUrl(_tag, filename, cdnBase = QINIU_CDN_BASE) {
  return `${normalizeCdnBase(cdnBase)}/releases/${filename}`;
}

export function qiniuObjectKey(filename, cdnBase = QINIU_CDN_BASE) {
  const prefix = qiniuPathPrefix(cdnBase);
  return prefix ? `${prefix}/releases/${filename}` : `releases/${filename}`;
}

export function qiniuAppcastKey(cdnBase = QINIU_CDN_BASE) {
  const prefix = qiniuPathPrefix(cdnBase);
  return prefix ? `${prefix}/updates/appcast.xml` : 'updates/appcast.xml';
}

export function qiniuLatestJsonKey(cdnBase = QINIU_CDN_BASE) {
  const prefix = qiniuPathPrefix(cdnBase);
  return prefix ? `${prefix}/updates/latest.json` : 'updates/latest.json';
}

export function assetUrl(tag, filename, assetBaseUrl) {
  if (assetBaseUrl) {
    return qiniuAssetUrl(tag, filename, assetBaseUrl);
  }
  return githubAssetUrl(tag, filename);
}

export function forcedUpdateSource(env = process.env) {
  const value = String(env.TINYNOTE_UPDATE_SOURCE || env.VITE_TINYNOTE_UPDATE_SOURCE || '')
    .trim()
    .toLowerCase();
  if (value === 'qiniu' || value === 'github') return value;
  return 'auto';
}

/** GitHub first; Qiniu only when testing or as the fallback list. */
export function updateSourceOrder(githubUrl, qiniuUrl, forced = 'auto') {
  if (forced === 'qiniu') return [qiniuUrl, githubUrl];
  if (forced === 'github') return [githubUrl];
  return [githubUrl, qiniuUrl];
}

export function isIgnorableReleaseAsset(name) {
  return (
    /\.(sig|json)$/i.test(name)
    || /\.app\.tar\.gz$/i.test(name)
    || /_updater/i.test(name)
    || /^appcast\.xml$/i.test(name)
    || /^latest\.json$/i.test(name)
    || /\.AppImage$/i.test(name)
  );
}
