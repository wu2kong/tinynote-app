#!/usr/bin/env node

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { execSync } from 'child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = join(ROOT, 'package.json');
const PACKAGE_LOCK = join(ROOT, 'package-lock.json');
const TAURI_CONF = join(ROOT, 'src-tauri', 'tauri.conf.json');
const APP_DESCRIPTION = '轻记——零碎笔记管理';

function run(cmd, options = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: options.inherit ? 'inherit' : 'pipe',
    ...options,
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

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function bumpPatch(version) {
  const parts = version.split('.').map((part) => Number(part) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join('.');
}

function isValidVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function tagName(version) {
  return `v${version}`;
}

function defaultNotes(version) {
  return `TinyNote v${version}\n\n${APP_DESCRIPTION}`;
}

function prompt(question, defaultValue = '') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const hint = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${hint}: `, (answer) => {
      rl.close();
      const value = answer.trim();
      resolve(value || defaultValue);
    });
  });
}

async function promptNotes(version) {
  const defaultValue = defaultNotes(version);
  console.log('\n默认 Release 描述:');
  console.log(defaultValue);
  console.log('');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('请输入 Release 描述（直接回车使用默认）: ', (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function confirm(question) {
  const answer = await prompt(`${question} (y/N)`, 'N');
  return ['y', 'yes'].includes(answer.toLowerCase());
}

function ensurePrerequisites() {
  if (!commandExists('git')) {
    throw new Error('未找到 git，请先安装 Git。');
  }
  if (!commandExists('gh')) {
    throw new Error(
      '未找到 GitHub CLI (gh)。请先安装并登录：\n' +
      '  https://cli.github.com/\n' +
      '  gh auth login'
    );
  }

  try {
    run('gh auth status');
  } catch {
    throw new Error('GitHub CLI 未登录，请先执行：gh auth login');
  }

  const remote = run('git remote get-url origin').trim();
  if (!remote.includes('tinynote-app')) {
    throw new Error(`当前 origin 不是 tinynote-app 仓库：${remote}`);
  }
}

function getGitStatus() {
  return run('git status --porcelain').trim();
}

function tagExists(tag) {
  try {
    run(`git rev-parse ${tag}`);
    return true;
  } catch {
    return false;
  }
}

function remoteTagExists(tag) {
  try {
    const output = run(`git ls-remote --tags origin refs/tags/${tag}`).trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

function updateVersionFiles(version) {
  const pkg = readJson(PACKAGE_JSON);
  pkg.version = version;
  writeJson(PACKAGE_JSON, pkg);

  const lock = readJson(PACKAGE_LOCK);
  lock.version = version;
  if (lock.packages?.['']) {
    lock.packages[''].version = version;
  }
  writeJson(PACKAGE_LOCK, lock);

  const tauriConf = readJson(TAURI_CONF);
  tauriConf.version = version;
  writeJson(TAURI_CONF, tauriConf);
}

async function main() {
  console.log('\n🚀 TinyNote 一键发布\n');

  ensurePrerequisites();

  const pkg = readJson(PACKAGE_JSON);
  const currentVersion = pkg.version;
  const suggestedVersion = bumpPatch(currentVersion);
  const branch = run('git branch --show-current').trim();

  if (branch !== 'main') {
    console.warn(`⚠️  当前分支为 ${branch}，建议在 main 分支发布。`);
    if (!(await confirm('是否继续'))) {
      console.log('已取消发布。');
      return;
    }
  }

  const dirty = getGitStatus();
  if (dirty) {
    console.warn('⚠️  工作区存在未提交改动:');
    console.log(dirty);
    if (!(await confirm('是否继续发布'))) {
      console.log('已取消发布。');
      return;
    }
  }

  const version = await prompt('请输入新版本号', suggestedVersion);
  if (!isValidVersion(version)) {
    throw new Error(`版本号格式无效：${version}，请使用 x.y.z 格式。`);
  }

  if (version === currentVersion) {
    throw new Error(`新版本号不能与当前版本相同：${currentVersion}`);
  }

  const tag = tagName(version);
  if (tagExists(tag) || remoteTagExists(tag)) {
    throw new Error(`标签 ${tag} 已存在，请更换版本号。`);
  }

  const notes = await promptNotes(version);

  console.log('\n发布信息确认:');
  console.log(`  当前版本: ${currentVersion}`);
  console.log(`  新版本:   ${version}`);
  console.log(`  标签:     ${tag}`);
  console.log(`  分支:     ${branch}`);
  console.log(`  仓库:     origin -> tinynote-app`);
  console.log('  描述:');
  console.log(notes.split('\n').map((line) => `    ${line}`).join('\n'));
  console.log('\n发布后将执行:');
  console.log('  1. 更新 package.json / package-lock.json / tauri.conf.json');
  console.log('  2. 提交版本变更');
  console.log('  3. 创建并推送 Git 标签');
  console.log('  4. 创建 GitHub Release，触发多平台构建\n');

  if (!(await confirm('确认发布'))) {
    console.log('已取消发布。');
    return;
  }

  console.log('\n📝 更新版本文件...');
  updateVersionFiles(version);

  console.log('📦 提交版本变更...');
  run('git add package.json package-lock.json src-tauri/tauri.conf.json', { inherit: true });
  run(`git commit -m "chore: release ${tag}"`, { inherit: true });

  console.log('🏷️  创建标签...');
  run(`git tag ${tag}`, { inherit: true });

  console.log('⬆️  推送到 GitHub...');
  run(`git push origin ${branch}`, { inherit: true });
  run(`git push origin ${tag}`, { inherit: true });

  console.log('🌐 创建 GitHub Release...');
  const notesFile = join(ROOT, '.release-notes.tmp');
  writeFileSync(notesFile, notes, 'utf-8');
  try {
    const notesPath = notesFile.replace(/\\/g, '/');
    run(`gh release create ${tag} --title "${tag}" --notes-file "${notesPath}"`, { inherit: true });
  } finally {
    try {
      unlinkSync(notesFile);
    } catch {
      // ignore cleanup errors
    }
  }

  console.log('\n✅ 发布完成！');
  console.log(`   Release: https://github.com/wu2kong/tinynote-app/releases/tag/${tag}`);
  console.log('   GitHub Actions 将自动构建 Windows / macOS / Linux 安装包。\n');
}

main().catch((error) => {
  console.error(`\n❌ 发布失败: ${error.message}\n`);
  process.exit(1);
});
