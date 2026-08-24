#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
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
  npm run build:appstore -- --profile /path/TinyNote.provisionprofile
  npm run build:appstore -- --profile /path/TinyNote.provisionprofile --upload

选项：
  --prepare-only                 只验证前端和 App Store Rust feature
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

function identityList() {
  try {
    return run('security', ['find-identity', '-v', '-p', 'codesigning'], { capture: true });
  } catch {
    return '';
  }
}

function findAppIdentity() {
  const output = identityList();
  const matches = [...output.matchAll(/"([^"]*Apple Distribution:[^"]*)"/g)];
  return matches.find((match) => match[1].includes(`(${TEAM_ID})`))?.[1]
    || matches[0]?.[1]
    || '';
}

function findInstallerIdentity() {
  let output = '';
  try {
    output = run('security', ['find-certificate', '-a'], { capture: true });
  } catch {
    return '';
  }
  const labels = [...output.matchAll(/"labl"<blob>="([^"]+)"/g)].map((match) => match[1]);
  return labels.find((label) =>
    (label.includes('Mac Installer Distribution:')
      || label.includes('3rd Party Mac Developer Installer:'))
    && label.includes(`(${TEAM_ID})`)
  ) || labels.find((label) =>
    label.includes('Mac Installer Distribution:')
      || label.includes('3rd Party Mac Developer Installer:')
  ) || '';
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
  const converted = spawnSync(
    'plutil',
    ['-convert', 'json', '-o', '-', '--', '-'],
    { encoding: 'utf8', input: plist },
  );
  if (converted.status !== 0) return null;
  try {
    return JSON.parse(converted.stdout);
  } catch {
    return null;
  }
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
  prepare();
  if (options.prepareOnly) {
    console.log('App Store 代码与配置预检通过。');
    return;
  }

  const profilePath = options.profile ? resolve(options.profile) : findProvisioningProfile();
  const appIdentity = options.appIdentity || findAppIdentity();
  const installerIdentity = options.installerIdentity || findInstallerIdentity();
  if (!profilePath) {
    throw new Error(`未找到 ${BUNDLE_ID} 的 Mac App Store Connect provisioning profile，请使用 --profile 指定`);
  }
  verifyProfile(profilePath);
  if (!appIdentity) {
    throw new Error('未找到 Apple Distribution 证书及其私钥，请先安装到登录钥匙串');
  }
  if (!installerIdentity) {
    throw new Error('未找到 Mac Installer Distribution 证书及其私钥，请先安装到登录钥匙串');
  }

  const version = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')).version;
  buildLocalConfig(profilePath, appIdentity, options.buildNumber);

  console.log(`使用 app 签名身份：${appIdentity}`);
  console.log(`使用 installer 签名身份：${installerIdentity}`);
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

  const appPath = join(TAURI_DIR, 'target', TARGET, 'release', 'bundle', 'macos', `${APP_NAME}.app`);
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
