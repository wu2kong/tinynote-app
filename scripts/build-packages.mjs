#!/usr/bin/env node

/**
 * 本地编译 TinyNote 各平台安装包，输出到 dist-packages/，便于手动上传
 * （GitHub Release、蓝奏云等）。
 *
 * 用法见 --help。
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'fs';
import { basename, dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_DIR = join(ROOT, 'src-tauri', 'target');
const OUT_DIR = join(ROOT, 'dist-packages');
const DOCKER_FILE = join(ROOT, 'scripts', 'docker', 'linux.Dockerfile');
const LINUX_SCRIPT = 'scripts/docker/build-linux.sh';
const DOCKER_IMAGE = 'tinynote-linux-builder:22';
const INSTALLER_EXT = /\.(dmg|exe|msi|AppImage|deb|rpm)$/i;
const EXTS_BY_PLATFORM = {
  macos: ['.dmg'],
  windows: ['.exe', '.msi'],
  linux: ['.appimage', '.deb', '.rpm'],
};

const PLATFORMS = {
  macos: {
    id: 'macos',
    label: 'macOS universal DMG',
    host: 'darwin',
    rustTargets: ['aarch64-apple-darwin', 'x86_64-apple-darwin'],
    tauriArgs: '--target universal-apple-darwin --bundles dmg',
  },
  windows: {
    id: 'windows',
    label: 'Windows NSIS / MSI',
    host: 'win32',
    rustTargets: [],
    tauriArgs: '--bundles nsis,msi',
  },
  linux: {
    id: 'linux',
    label: 'Linux AppImage / deb / rpm (x64)',
    host: 'linux',
    rustTargets: [],
    tauriArgs: '--bundles appimage,deb,rpm',
  },
};

function run(cmd, options = {}) {
  return execSync(cmd, {
    cwd: options.cwd ?? ROOT,
    encoding: 'utf-8',
    stdio: options.inherit ? 'inherit' : 'pipe',
    env: { ...process.env, CARGO_TERM_COLOR: 'always', ...options.env },
  });
}

function commandExists(name) {
  try {
    const check = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
    run(check);
    return true;
  } catch {
    return false;
  }
}

function printHelp() {
  console.log(`
TinyNote 本地打包 — 编译安装包，便于手动上传

用法:
  npm run build:packages                     打包当前系统
  npm run build:packages -- macos            macOS universal DMG
  npm run build:packages -- windows          Windows NSIS / MSI（需在 Windows 上运行）
  npm run build:packages -- linux            Linux AppImage / deb / rpm
  npm run build:packages -- linux --docker   非 Linux 主机用 Docker 交叉打包 Linux x64
  npm run build:packages -- --all            当前机器能编的全部平台
  npm run build:packages -- --upload [tag]   打包后上传到 GitHub Release（默认当前版本 vX.Y.Z）

说明:
  · Tauri 安装包必须在对应系统上打包（macOS→DMG，Windows→EXE/MSI，Linux→AppImage/deb/rpm）
  · 在 macOS / Windows 上可用 Docker 额外产出 Linux x64 包
  · Windows 安装包仍需在 Windows 上构建，或走现有 GitHub Actions
  · 产物写入 dist-packages/，文件名与官网下载页 / GitHub Release 资源名对齐
`);
}

function parseArgs(argv) {
  const flags = {
    help: false,
    all: false,
    docker: false,
    upload: false,
    uploadTag: '',
    platforms: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      flags.help = true;
    } else if (arg === '--all') {
      flags.all = true;
    } else if (arg === '--docker') {
      flags.docker = true;
    } else if (arg === '--upload') {
      flags.upload = true;
      const next = argv[i + 1];
      if (next && !next.startsWith('-') && !PLATFORMS[next]) {
        flags.uploadTag = next;
        i += 1;
      }
    } else if (PLATFORMS[arg]) {
      flags.platforms.push(arg);
    } else {
      throw new Error(`未知参数：${arg}（使用 --help 查看用法）`);
    }
  }

  return flags;
}

function currentPlatformId() {
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'linux') return 'linux';
  throw new Error(`不支持在 ${process.platform} 上打包`);
}

function getVersion() {
  return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version;
}

function resolveJobs(flags) {
  const host = currentPlatformId();
  let requested = flags.platforms.slice();

  if (flags.all) {
    requested = Object.keys(PLATFORMS);
  } else if (requested.length === 0) {
    requested = [host];
  }

  const jobs = [];
  const skipped = [];

  for (const id of requested) {
    const platform = PLATFORMS[id];
    const native = platform.host === process.platform;
    const useDocker = id === 'linux' && !native && flags.docker;

    if (native || useDocker) {
      jobs.push({ ...platform, useDocker });
    } else if (id === 'linux') {
      skipped.push({
        id,
        reason: '当前不是 Linux。加上 --docker 可在 Docker 中交叉打包 Linux x64。',
      });
    } else {
      skipped.push({
        id,
        reason: `需要在 ${platform.label.split(' ')[0]} 上构建（或使用 GitHub Actions）。`,
      });
    }
  }

  return { jobs, skipped };
}

function ensurePrerequisites(jobs) {
  if (!commandExists('node')) {
    throw new Error('未找到 node，请先安装 Node.js 22+。');
  }
  if (!existsSync(join(ROOT, 'node_modules', '@tauri-apps', 'cli'))) {
    console.log('📦 安装前端依赖...\n');
    run('npm install', { inherit: true });
  }

  const needsNativeRust = jobs.some((job) => !job.useDocker);
  if (needsNativeRust) {
    if (!commandExists('cargo') || !commandExists('rustup')) {
      throw new Error('未找到 Rust。请先安装：https://rustup.rs/');
    }
  }

  if (jobs.some((job) => job.id === 'macos')) {
    try {
      run('xcode-select -p');
    } catch {
      throw new Error('未找到 Xcode Command Line Tools。请执行：xcode-select --install');
    }
    console.log('\n⬇️  准备 Sparkle 框架...\n');
    run('bash scripts/download-sparkle.sh', { inherit: true });
  }

  if (jobs.some((job) => job.useDocker) && !commandExists('docker')) {
    throw new Error('未找到 Docker。打包 Linux 请先安装 Docker Desktop，或在 Linux 机器上直接构建。');
  }
}

function ensureRustTargets(targets) {
  for (const target of targets) {
    console.log(`🎯 添加 Rust target: ${target}`);
    run(`rustup target add ${target}`, { inherit: true });
  }
}

function buildNative(job) {
  console.log(`\n🔨 构建 ${job.label}...\n`);
  if (job.rustTargets.length) {
    ensureRustTargets(job.rustTargets);
  }
  run(`npx tauri build ${job.tauriArgs}`, { inherit: true });
}

function ensureDockerImage() {
  try {
    run(`docker image inspect ${DOCKER_IMAGE}`);
    return;
  } catch {
    // rebuild
  }

  console.log(`\n🐳 构建 Linux 打包镜像 ${DOCKER_IMAGE}（首次较慢）...\n`);
  run(
    `docker build --platform linux/amd64 -f "${DOCKER_FILE}" -t ${DOCKER_IMAGE} "${join(ROOT, 'scripts', 'docker')}"`,
    { inherit: true },
  );
}

function buildLinuxDocker() {
  console.log(`\n🐳 在 Docker 中构建 Linux x64 安装包...\n`);
  ensureDockerImage();

  const uid = process.getuid?.() ?? 0;
  const gid = process.getgid?.() ?? 0;
  const cmd = [
    'docker run --rm --platform linux/amd64',
    `-v "${ROOT}:/app"`,
    '-v tinynote-linux-node-modules:/app/node_modules',
    '-v tinynote-linux-cargo-registry:/opt/cargo/registry',
    '-v tinynote-linux-cargo-git:/opt/cargo/git',
    `-e HOST_UID=${uid}`,
    `-e HOST_GID=${gid}`,
    '-w /app',
    DOCKER_IMAGE,
    `bash ${LINUX_SCRIPT}`,
  ].join(' ');

  run(cmd, { inherit: true });
}

function isInstaller(filePath) {
  const name = basename(filePath);
  if (/\.(sig|json|blockmap)$/i.test(name)) return false;
  if (/\.app\.tar\.gz$/i.test(name)) return false;
  if (!INSTALLER_EXT.test(name)) return false;
  const normalized = filePath.split(/[/\\]/).join('/');
  return /\/release\/bundle\//.test(normalized);
}

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let n = bytes;
  let i = -1;
  do {
    n /= 1024;
    i += 1;
  } while (n >= 1024 && i < units.length - 1);
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function collectInstallers(jobs) {
  const wanted = new Set(
    jobs.flatMap((job) => EXTS_BY_PLATFORM[job.id] || []),
  );
  const files = walkFiles(TARGET_DIR).filter((filePath) => {
    if (!isInstaller(filePath)) return false;
    return wanted.has(extname(filePath).toLowerCase());
  });
  mkdirSync(OUT_DIR, { recursive: true });

  const copied = [];
  for (const src of files) {
    const name = basename(src);
    const dest = join(OUT_DIR, name);
    copyFileSync(src, dest);
    copied.push({
      name,
      dest,
      size: statSync(dest).size,
    });
  }

  copied.sort((a, b) => a.name.localeCompare(b.name));
  return copied;
}

function generateSparkleAppcast(version, files) {
  const dmg = files.find((file) => /\.dmg$/i.test(file.name));
  if (!dmg) return files;

  const out = join(OUT_DIR, 'appcast.xml');
  console.log('\n🔏 生成 Sparkle appcast...\n');
  try {
    run(
      `node scripts/generate-sparkle-appcast.mjs "${dmg.dest}" --version ${version} --out "${out}"`,
      { inherit: true },
    );
  } catch (error) {
    console.warn('⚠️  未能生成 Sparkle appcast，macOS 自动更新将不可用。');
    console.warn(`   ${error.message || error}`);
    return files;
  }

  return [
    ...files,
    {
      name: 'appcast.xml',
      dest: out,
      size: statSync(out).size,
    },
  ];
}

function uploadRelease(tag, files) {
  if (!commandExists('gh')) {
    throw new Error('未找到 GitHub CLI (gh)。安装后才可 --upload：https://cli.github.com/');
  }
  try {
    run('gh auth status');
  } catch {
    throw new Error('GitHub CLI 未登录，请先执行：gh auth login');
  }

  const paths = files.map((file) => `"${file.dest}"`).join(' ');
  console.log(`\n⬆️  上传到 GitHub Release ${tag}...\n`);
  run(`gh release upload ${tag} ${paths} --clobber`, { inherit: true });
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return;
  }

  const version = getVersion();
  const { jobs, skipped } = resolveJobs(flags);

  console.log('\n📦 TinyNote 本地打包');
  console.log(`   版本: v${version}`);
  console.log(`   主机: ${process.platform} / ${process.arch}`);
  console.log(`   任务: ${jobs.length ? jobs.map((job) => job.id).join(', ') : '无'}`);
  if (skipped.length) {
    for (const item of skipped) {
      console.log(`   跳过 ${item.id}: ${item.reason}`);
    }
  }

  if (!jobs.length) {
    throw new Error('没有可执行的打包任务。使用 --help 查看用法。');
  }

  ensurePrerequisites(jobs);

  if (existsSync(OUT_DIR)) {
    rmSync(OUT_DIR, { recursive: true, force: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });

  for (const job of jobs) {
    if (job.useDocker) buildLinuxDocker();
    else buildNative(job);
  }

  const files = generateSparkleAppcast(version, collectInstallers(jobs));
  if (!files.length) {
    throw new Error('构建完成，但未找到安装包。请检查 src-tauri/target/**/release/bundle/');
  }

  console.log('\n✅ 安装包已输出到 dist-packages/\n');
  for (const file of files) {
    console.log(`   ${file.name.padEnd(42)} ${formatBytes(file.size)}`);
  }

  if (flags.upload) {
    const tag = flags.uploadTag || `v${version}`;
    uploadRelease(tag, files);
    console.log(`\n   Release: https://github.com/wu2kong/tinynote-app/releases/tag/${tag}`);
  } else {
    console.log('\n可手动上传以上文件到 GitHub Release 或蓝奏云。');
    console.log(`可选：npm run build:packages -- --upload v${version}`);
  }

  console.log('');
}

main().catch((error) => {
  console.error(`\n❌ 打包失败: ${error.message}\n`);
  process.exit(1);
});
