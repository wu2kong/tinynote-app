#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TAURI_DIR = join(ROOT, 'src-tauri');
const TEMPLATE_CONFIG = join(TAURI_DIR, 'tauri.appstore.conf.json');
const LOCAL_CONFIG = join(TAURI_DIR, 'tauri.appstore.local.conf.json');
const PACKAGE_JSON = join(ROOT, 'package.json');
const APP_NAME = 'TinyNote';
const BUNDLE_ID = 'com.wu2kong.tinynote.app';
const TEAM_ID = '2S49AWBH4X';
const TARGET = 'universal-apple-darwin';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: {
      ...process.env,
      // StoreKit 2 / Swift concurrency requires macOS 13+; Tauri debug defaults to 11.0
      // and would link @rpath/libswift_Concurrency.dylib (missing at runtime).
      MACOSX_DEPLOYMENT_TARGET: '13.0',
      VITE_DISTRIBUTION: 'mac-app-store',
      ...options.env,
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr || result.stdout}` : '';
    throw new Error(`${command} ${args.join(' ')} 失败${detail}`);
  }
  return result.stdout?.trim() ?? '';
}

function parseArgs(argv) {
  const options = {
    prepareOnly: false,
    localIap: false,
    upload: false,
    profile: process.env.APPLE_PROVISIONING_PROFILE || '',
    appIdentity: process.env.APPLE_SIGNING_IDENTITY || '',
    installerIdentity: process.env.APPLE_INSTALLER_IDENTITY || '',
    buildNumber: process.env.APPLE_BUILD_NUMBER || '',
    apiKey: process.env.APPLE_API_KEY_ID || process.env.APPLE_API_KEY || '',
    apiIssuer: process.env.APPLE_API_ISSUER || '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--prepare-only') {
      options.prepareOnly = true;
    } else if (argument === '--local-iap') {
      options.localIap = true;
    } else if (argument === '--upload') {
      options.upload = true;
    } else if (argument === '--profile') {
      options.profile = argv[++index] || '';
    } else if (argument === '--app-identity') {
      options.appIdentity = argv[++index] || '';
    } else if (argument === '--installer-identity') {
      options.installerIdentity = argv[++index] || '';
    } else if (argument === '--build-number') {
      options.buildNumber = argv[++index] || '';
    } else if (argument === '--api-key') {
      options.apiKey = argv[++index] || '';
    } else if (argument === '--api-issuer') {
      options.apiIssuer = argv[++index] || '';
    } else if (argument === '--help' || argument === '-h') {
      console.log(`
TinyNote Mac App Store 构建

  npm run build:appstore:prepare
  npm run build:appstore:local
  npm run build:appstore -- --profile /path/TinyNote.provisionprofile
  npm run build:appstore -- --profile /path/TinyNote.provisionprofile --upload

选项：
  --prepare-only                 只验证前端和 App Store Rust feature
  --local-iap                   用 Apple Development 签名，供本机沙盒测 IAP（不能上传商店）
  --profile PATH                Mac App Store Connect provisioning profile
  --app-identity NAME           Apple Distribution 签名身份
  --installer-identity NAME     Mac Installer Distribution 签名身份
  --build-number NUMBER         CFBundleVersion
  --upload                      验证后上传 App Store Connect
  --api-key ID                  App Store Connect API Key ID
  --api-issuer ID               App Store Connect API Issuer ID
`);
      process.exit(0);
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }
  return options;
}

function identityList(codesigningOnly = false) {
  const args = codesigningOnly
    ? ['find-identity', '-v', '-p', 'codesigning']
    : ['find-identity', '-v'];
  try {
    return run('security', args, { capture: true });
  } catch {
    return '';
  }
}

function parseIdentities(output) {
  return [...output.matchAll(/^\s*\d+\)\s+([A-F0-9]{40})\s+"([^"]+)"/gim)].map((match) => ({
    hash: match[1].toUpperCase(),
    name: match[2],
  }));
}

function isMacAppStoreAppIdentity(name) {
  return name.includes('Apple Distribution:')
    || name.includes('Mac App Distribution:')
    || name.includes('3rd Party Mac Developer Application:');
}

function isMacAppStoreInstallerIdentity(name) {
  return name.includes('Mac Installer Distribution:')
    || name.includes('3rd Party Mac Developer Installer:');
}

function formatIdentity(identity) {
  return identity ? `${identity.name} [${identity.hash}]` : '';
}

function resolveNamedOrHashedIdentity(requested, identities, label) {
  if (/^[A-Fa-f0-9]{40}$/.test(requested)) {
    return requested.toUpperCase();
  }
  const named = identities.filter((item) => item.name === requested);
  if (named.length === 0) {
    throw new Error(`未找到${label}签名身份：${requested}`);
  }
  return named[0].hash;
}

function resolveAppIdentity(requested, profilePath) {
  const identities = parseIdentities(identityList(true)).filter((item) =>
    isMacAppStoreAppIdentity(item.name)
  );
  const teamIdentities = identities.filter((item) => item.name.includes(`(${TEAM_ID})`));
  const pool = teamIdentities.length ? teamIdentities : identities;
  const profileHashes = new Set(decodeProfile(profilePath)?.DeveloperCertificatesSha1 || []);

  if (requested) {
    if (/^[A-Fa-f0-9]{40}$/.test(requested)) {
      return requested.toUpperCase();
    }
    const named = pool.filter((item) => item.name === requested);
    if (named.length === 0) {
      throw new Error(`未找到 Apple Distribution 签名身份：${requested}`);
    }
    if (profileHashes.size) {
      const matched = named.filter((item) => profileHashes.has(item.hash));
      if (matched.length >= 1) return matched[0].hash;
    }
    if (named.length > 1) {
      throw new Error(
        `签名身份名称有歧义：${requested}。请删除钥匙串中的重复证书，或改用 SHA-1：${named.map(formatIdentity).join('; ')}`,
      );
    }
    return named[0].hash;
  }

  if (profileHashes.size) {
    const matched = pool.filter((item) => profileHashes.has(item.hash));
    if (matched.length >= 1) return matched[0].hash;
    if (pool.length > 0) {
      throw new Error(
        `Provisioning profile 绑定的证书不在钥匙串中（SHA-1: ${[...profileHashes].join(', ')}）。`
        + `当前 Mac App Store 身份：${pool.map(formatIdentity).join('; ') || '无'}`,
      );
    }
    return '';
  }

  return pool[0]?.hash || '';
}

function resolveInstallerIdentity(requested) {
  const identities = parseIdentities(identityList(false)).filter((item) =>
    isMacAppStoreInstallerIdentity(item.name)
  );
  if (requested) {
    return resolveNamedOrHashedIdentity(requested, identities, ' Mac Installer Distribution ');
  }
  const teamMatches = identities.filter((item) => item.name.includes(`(${TEAM_ID})`));
  const matches = teamMatches.length ? teamMatches : identities;
  return matches[0]?.hash || '';
}

function resolveDevelopmentIdentity(requested) {
  const identities = parseIdentities(identityList(true)).filter((item) =>
    item.name.includes('Apple Development:')
  );
  if (requested) {
    return resolveNamedOrHashedIdentity(requested, identities, ' Apple Development ');
  }
  return identities[0]?.hash || '';
}

function identityDisplay(hashOrName) {
  const match = parseIdentities(identityList(false)).find((item) =>
    item.hash === hashOrName.toUpperCase() || item.name === hashOrName
  );
  return formatIdentity(match) || hashOrName;
}

function extractCertificateSha1s(plist) {
  const block = plist.match(/<key>DeveloperCertificates<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] || '';
  return [...block.matchAll(/<data>([\s\S]*?)<\/data>/g)].map((match) =>
    createHash('sha1')
      .update(Buffer.from(match[1].replace(/\s+/g, ''), 'base64'))
      .digest('hex')
      .toUpperCase()
  );
}

function decodeProfile(path) {
  const security = spawnSync('security', ['cms', '-D', '-i', path], { encoding: 'utf8' });
  let plist = security.status === 0 ? security.stdout : '';
  if (!plist) {
    const openssl = spawnSync(
      'openssl',
      ['smime', '-inform', 'DER', '-verify', '-noverify', '-in', path],
      { encoding: 'utf8' },
    );
    if (openssl.status !== 0) return null;
    plist = openssl.stdout;
  }
  const certificateSha1s = extractCertificateSha1s(plist);
  const converted = spawnSync(
    'plutil',
    ['-convert', 'json', '-o', '-', '--', '-'],
    { encoding: 'utf8', input: plist },
  );
  if (converted.status === 0) {
    try {
      return {
        ...JSON.parse(converted.stdout),
        DeveloperCertificatesSha1: certificateSha1s,
      };
    } catch {
      // Fall through to the XML parser below.
    }
  }

  // Newer profiles embed DER data that `plutil -convert json` cannot represent.
  // Parse the small set of fields needed for signing validation directly instead.
  const valueForKey = (key, tag) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = plist.match(new RegExp(`<key>${escapedKey}</key>\\s*<${tag}>([^<]*)</${tag}>`));
    return match?.[1] || '';
  };
  const entitlements = plist.match(/<key>Entitlements<\/key>\s*<dict>([\s\S]*?)<\/dict>/)?.[1] || '';
  const appIdentifier = entitlements.match(
    /<key>com\.apple\.application-identifier<\/key>\s*<string>([^<]*)<\/string>/,
  )?.[1] || '';
  const platform = plist.match(/<key>Platform<\/key>\s*<array>\s*<string>([^<]*)<\/string>/)?.[1] || '';
  const expirationDate = valueForKey('ExpirationDate', 'date');
  if (!appIdentifier || !platform || !expirationDate) return null;
  return {
    Entitlements: { 'com.apple.application-identifier': appIdentifier },
    Platform: [platform],
    ExpirationDate: expirationDate,
    DeveloperCertificatesSha1: certificateSha1s,
  };
}

function isMatchingProfile(path) {
  const profile = decodeProfile(path);
  if (!profile) return false;
  const entitlements = profile.Entitlements || {};
  const appIdentifier = entitlements['com.apple.application-identifier']
    || entitlements['application-identifier']
    || '';
  const platforms = profile.Platform || [];
  const expiresAt = Date.parse(profile.ExpirationDate || '');
  return appIdentifier === `${TEAM_ID}.${BUNDLE_ID}`
    && platforms.some((platform) => /OSX|macOS/i.test(platform))
    && Number.isFinite(expiresAt)
    && expiresAt > Date.now();
}

function provisioningProfileCandidates() {
  const profileDirs = [
    join(process.env.HOME || '', 'Library', 'Developer', 'Xcode', 'UserData', 'Provisioning Profiles'),
    join(process.env.HOME || '', 'Library', 'MobileDevice', 'Provisioning Profiles'),
  ];
  return profileDirs.flatMap((directory) => {
    if (!existsSync(directory)) return [];
    return readdirSync(directory)
      .filter((name) => /\.(mobileprovision|provisionprofile)$/i.test(name))
      .map((name) => join(directory, name))
      .filter((path) => statSync(path).isFile());
  });
}

function findProvisioningProfile() {
  return provisioningProfileCandidates().find(isMatchingProfile) || '';
}

function buildLocalConfig(profilePath, appIdentity, buildNumber) {
  const config = JSON.parse(readFileSync(TEMPLATE_CONFIG, 'utf8'));
  config.bundle.macOS.files = {
    'embedded.provisionprofile': resolve(profilePath),
  };
  config.bundle.macOS.signingIdentity = appIdentity;
  if (buildNumber) config.bundle.macOS.bundleVersion = buildNumber;
  writeFileSync(LOCAL_CONFIG, `${JSON.stringify(config, null, 2)}\n`);
}

function buildLocalIapConfig(appIdentity, buildNumber) {
  const config = JSON.parse(readFileSync(TEMPLATE_CONFIG, 'utf8'));
  config.bundle.macOS.entitlements = './Entitlements.appstore-local.plist';
  config.bundle.macOS.signingIdentity = appIdentity;
  config.bundle.macOS.hardenedRuntime = false;
  delete config.bundle.macOS.files;
  if (buildNumber) config.bundle.macOS.bundleVersion = buildNumber;
  writeFileSync(LOCAL_CONFIG, `${JSON.stringify(config, null, 2)}\n`);
}

const APP_BUNDLE_DIR = join(TAURI_DIR, 'target', TARGET, 'release', 'bundle', 'macos');
const APP_PATH = join(APP_BUNDLE_DIR, `${APP_NAME}.app`);
const LOCAL_IAP_APP_PATH = join(APP_BUNDLE_DIR, `${APP_NAME}-local.app`);

function signLocalIapApp(appIdentity) {
  const profilePath = join(APP_PATH, 'Contents', 'embedded.provisionprofile');
  if (existsSync(profilePath)) rmSync(profilePath);
  run('codesign', [
    '--force',
    '--deep',
    '--sign', appIdentity,
    '--entitlements', join(TAURI_DIR, 'Entitlements.appstore-local.plist'),
    APP_PATH,
  ]);
  rmSync(LOCAL_IAP_APP_PATH, { recursive: true, force: true });
  cpSync(APP_PATH, LOCAL_IAP_APP_PATH, { recursive: true });
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', LOCAL_IAP_APP_PATH]);
}

function verifyProfile(profilePath) {
  if (!existsSync(profilePath)) {
    throw new Error(`找不到 provisioning profile：${profilePath}`);
  }
  if (!isMatchingProfile(profilePath)) {
    throw new Error(
      `Provisioning profile 必须是 ${TEAM_ID}.${BUNDLE_ID} 对应的有效 Mac App Store Connect profile`,
    );
  }
}

function prepare() {
  console.log('验证 Mac App Store 前端、Tauri 配置和无 Sparkle 的 Rust feature…');
  run('npx', [
    'tauri', 'build',
    '--debug',
    '--no-bundle',
    '--features', 'app-store',
    '--config', TEMPLATE_CONFIG,
    '--', '--no-default-features',
  ]);
}

function main() {
  if (process.platform !== 'darwin') {
    throw new Error('Mac App Store 构建必须在 macOS 上运行');
  }
  const options = parseArgs(process.argv.slice(2));
  if (!options.localIap) {
    prepare();
  }
  if (options.prepareOnly) {
    console.log('App Store 代码与配置预检通过。');
    return;
  }

  if (options.localIap) {
    if (options.upload) {
      throw new Error('--local-iap 产物不能上传 App Store，请去掉 --upload');
    }
    const appIdentity = resolveDevelopmentIdentity(options.appIdentity);
    if (!appIdentity) {
      throw new Error('未找到 Apple Development 证书及其私钥，请先安装到登录钥匙串');
    }
    buildLocalIapConfig(appIdentity, options.buildNumber);
    console.log('构建本机可启动的商店版 .app（Apple Development 签名，用于 Sandbox IAP）…');
    console.log(`使用 app 签名身份：${identityDisplay(appIdentity)}`);
    run('npx', [
      'tauri', 'build',
      '--no-bundle',
      '--target', TARGET,
      '--features', 'app-store',
      '--config', LOCAL_CONFIG,
      '--', '--no-default-features',
    ], { env: { APPLE_SIGNING_IDENTITY: appIdentity } });
    run('npx', [
      'tauri', 'bundle',
      '--bundles', 'app',
      '--target', TARGET,
      '--features', 'app-store',
      '--config', LOCAL_CONFIG,
    ], { env: { APPLE_SIGNING_IDENTITY: appIdentity } });
    if (!existsSync(APP_PATH)) throw new Error(`未找到构建产物：${APP_PATH}`);
    signLocalIapApp(appIdentity);
    console.log(`完成：${LOCAL_IAP_APP_PATH}`);
    console.log(`启动：open "${LOCAL_IAP_APP_PATH}"`);
    console.log('这是本机 IAP 测试包，不要上传 App Store Connect。');
    return;
  }

  const profilePath = options.profile ? resolve(options.profile) : findProvisioningProfile();
  if (!profilePath) {
    throw new Error(`未找到 ${BUNDLE_ID} 的 Mac App Store Connect provisioning profile，请使用 --profile 指定`);
  }
  verifyProfile(profilePath);
  const appIdentity = resolveAppIdentity(options.appIdentity, profilePath);
  const installerIdentity = resolveInstallerIdentity(options.installerIdentity);
  if (!appIdentity) {
    throw new Error('未找到 Apple Distribution 证书及其私钥，请先安装到登录钥匙串');
  }
  if (!installerIdentity) {
    throw new Error('未找到 Mac Installer Distribution 证书及其私钥，请先安装到登录钥匙串');
  }

  const version = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')).version;
  buildLocalConfig(profilePath, appIdentity, options.buildNumber);

  console.log(`使用 app 签名身份：${identityDisplay(appIdentity)}`);
  console.log(`使用 installer 签名身份：${identityDisplay(installerIdentity)}`);
  run('npx', [
    'tauri', 'build',
    '--no-bundle',
    '--target', TARGET,
    '--features', 'app-store',
    '--config', LOCAL_CONFIG,
    '--', '--no-default-features',
  ], { env: { APPLE_SIGNING_IDENTITY: appIdentity } });
  run('npx', [
    'tauri', 'bundle',
    '--bundles', 'app',
    '--target', TARGET,
    '--features', 'app-store',
    '--config', LOCAL_CONFIG,
  ], { env: { APPLE_SIGNING_IDENTITY: appIdentity } });

  const appPath = APP_PATH;
  if (!existsSync(appPath)) throw new Error(`未找到构建产物：${appPath}`);
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);

  const outputDir = join(ROOT, 'dist-packages');
  mkdirSync(outputDir, { recursive: true });
  const pkgPath = join(outputDir, `${APP_NAME}-${version}-mac-app-store.pkg`);
  run('xcrun', [
    'productbuild',
    '--sign', installerIdentity,
    '--component', appPath,
    '/Applications',
    pkgPath,
  ]);
  run('pkgutil', ['--check-signature', pkgPath]);

  if (options.upload) {
    if (!options.apiKey || !options.apiIssuer) {
      throw new Error('--upload 需要 APPLE_API_KEY_ID 和 APPLE_API_ISSUER（或对应命令行参数）');
    }
    run('xcrun', [
      'altool', '--validate-app',
      '--type', 'macos',
      '--file', pkgPath,
      '--apiKey', options.apiKey,
      '--apiIssuer', options.apiIssuer,
    ]);
    run('xcrun', [
      'altool', '--upload-app',
      '--type', 'macos',
      '--file', pkgPath,
      '--apiKey', options.apiKey,
      '--apiIssuer', options.apiIssuer,
    ]);
  }

  console.log(`完成：${pkgPath}`);
}

try {
  main();
} catch (error) {
  console.error(`\nMac App Store 构建失败：${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
