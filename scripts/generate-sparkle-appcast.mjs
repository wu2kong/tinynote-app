#!/usr/bin/env node

/**
 * Sign macOS DMG / Windows NSIS installer with Sparkle-compatible EdDSA
 * and write a combined appcast.xml.
 *
 * Usage:
 *   node scripts/generate-sparkle-appcast.mjs [file ...]
 *     [--version x.y.z] [--tag vX.Y.Z] [--notes "..."] [--notes-file path]
 *     [--out appcast.xml] [--asset-base-url https://cdn.example.com]
 *     [--latest-json latest.json] [--latest-files-dir dir]
 *
 * Signing key (first match wins):
 *   1. SPARKLE_PRIVATE_KEY env (CI)
 *   2. src-tauri/sparkle_eddsa_private.key
 *   3. macOS Keychain account tinynote-app
 *   4. winsparkle-tool.exe on Windows
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execFileSync, spawnSync } from 'child_process';

import { GITHUB_REPO, assetUrl, isIgnorableReleaseAsset } from './lib/update-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = GITHUB_REPO;
const SPARKLE_ACCOUNT = 'tinynote-app';
const SIGN_UPDATE = join(ROOT, 'src-tauri', 'sparkle-bin', 'sign_update');
const WINSPARKLE_TOOL = join(ROOT, 'src-tauri', 'winsparkle', 'winsparkle-tool.exe');
const PRIVATE_KEY_FILE = join(ROOT, 'src-tauri', 'sparkle_eddsa_private.key');
const PACKAGE_JSON = join(ROOT, 'package.json');
const DEFAULT_OUT = join(ROOT, 'appcast.xml');

function parseArgs(argv) {
  const options = {
    files: [],
    version: '',
    tag: '',
    notes: '',
    notesFile: '',
    out: DEFAULT_OUT,
    assetBaseUrl: '',
    latestJson: '',
    latestFilesDir: '',
    publishedAt: '',
    htmlUrl: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      options.files.push(arg);
      continue;
    }
    const value = argv[i + 1];
    switch (arg) {
      case '--version':
        options.version = value;
        i += 1;
        break;
      case '--tag':
        options.tag = value;
        i += 1;
        break;
      case '--notes':
        options.notes = value;
        i += 1;
        break;
      case '--notes-file':
        options.notesFile = value;
        i += 1;
        break;
      case '--url':
      case '--asset-base-url':
        options.assetBaseUrl = value;
        i += 1;
        break;
      case '--out':
        options.out = value;
        i += 1;
        break;
      case '--latest-json':
        options.latestJson = value;
        i += 1;
        break;
      case '--latest-files-dir':
        options.latestFilesDir = value;
        i += 1;
        break;
      case '--published-at':
        options.publishedAt = value;
        i += 1;
        break;
      case '--html-url':
        options.htmlUrl = value;
        i += 1;
        break;
      default:
        throw new Error(`未知参数: ${arg}`);
    }
  }
  return options;
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

function resolvePath(explicit) {
  const path = explicit.startsWith('/') || /^[A-Za-z]:[\\/]/.test(explicit)
    ? explicit
    : join(ROOT, explicit);
  if (!existsSync(path)) {
    throw new Error(`找不到更新包: ${path}`);
  }
  return path;
}

function detectOs(filename) {
  if (/\.dmg$/i.test(filename)) return 'macos';
  if (/x64-setup\.exe$/i.test(filename)) return 'windows-x64';
  return null;
}

function findUpdaterFiles(explicit) {
  if (explicit.length) {
    return explicit.map(resolvePath);
  }

  const files = walkFiles(join(ROOT, 'src-tauri', 'target'))
    .filter((filePath) => {
      const normalized = filePath.split(/[/\\]/).join('/');
      return normalized.includes('/release/bundle/');
    })
    .filter((filePath) => detectOs(basename(filePath)))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  const picked = [];
  for (const os of ['macos', 'windows-x64']) {
    const match = files.find((filePath) => detectOs(basename(filePath)) === os);
    if (match) picked.push(match);
  }
  if (!picked.length) {
    throw new Error('未找到 macOS DMG 或 Windows 安装包，请先构建或传入路径。');
  }
  return picked;
}

function escapeXml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function rfc822Date(date = new Date()) {
  return date.toUTCString();
}

function signWithSparkle(filePath) {
  const envKey = process.env.SPARKLE_PRIVATE_KEY?.trim();
  if (envKey) {
    const result = spawnSync(SIGN_UPDATE, ['--ed-key-file', '-', filePath], {
      input: `${envKey}\n`,
      encoding: 'utf-8',
    });
    if (result.status !== 0) {
      throw new Error(`sign_update 失败: ${result.stderr || result.stdout || result.status}`);
    }
    return result.stdout.trim();
  }
  if (existsSync(PRIVATE_KEY_FILE)) {
    return execFileSync(SIGN_UPDATE, ['--ed-key-file', PRIVATE_KEY_FILE, filePath], {
      encoding: 'utf-8',
    }).trim();
  }
  return execFileSync(SIGN_UPDATE, ['--account', SPARKLE_ACCOUNT, filePath], {
    encoding: 'utf-8',
  }).trim();
}

function signWithWinSparkle(filePath) {
  const envKey = process.env.SPARKLE_PRIVATE_KEY?.trim();
  const args = ['sign'];
  if (envKey) {
    const result = spawnSync(WINSPARKLE_TOOL, [...args, '-f', '-', filePath], {
      input: `${envKey}\n`,
      encoding: 'utf-8',
    });
    if (result.status !== 0) {
      throw new Error(`winsparkle-tool 失败: ${result.stderr || result.stdout || result.status}`);
    }
    return result.stdout.trim();
  }
  if (!existsSync(PRIVATE_KEY_FILE)) {
    throw new Error('未找到 Sparkle 私钥文件。');
  }
  return execFileSync(WINSPARKLE_TOOL, [...args, '-f', PRIVATE_KEY_FILE, filePath], {
    encoding: 'utf-8',
  }).trim();
}

function signUpdate(filePath) {
  if (existsSync(SIGN_UPDATE)) {
    return signWithSparkle(filePath);
  }

  if (existsSync(WINSPARKLE_TOOL)) {
    return signWithWinSparkle(filePath);
  }

  throw new Error('未找到签名工具。请先运行 ./scripts/download-sparkle.sh 或 ./scripts/download-winsparkle.sh');
}

function parseSignature(output, filePath) {
  const signature = output.match(/sparkle:edSignature="([^"]+)"/)?.[1]
    || output.match(/^[A-Za-z0-9+/]+=*$/m)?.[0];
  const length = output.match(/length="(\d+)"/)?.[1] || String(statSync(filePath).size);
  if (!signature) {
    throw new Error(`无法解析签名输出:\n${output}`);
  }
  return { signature, length };
}

function readNotes(options, version) {
  if (options.notesFile) {
    return readFileSync(options.notesFile, 'utf-8').trim();
  }
  if (options.notes) return options.notes.trim();
  return `TinyNote v${version}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * Sparkle / WinSparkle render <description> as HTML, not Markdown.
 * GitHub release notes are Markdown, so convert before writing the appcast.
 */
export function markdownToHtml(markdown) {
  const source = String(markdown ?? '').replace(/\r\n/g, '\n').trim();
  if (!source) return '';
  if (/^</.test(source)) return source;

  const blocks = [];
  let listItems = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p style="margin:0 0 8px;">${renderInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems) return;
    const items = listItems
      .map((item) => `<li style="margin:0.2em 0;">${renderInlineMarkdown(item)}</li>`)
      .join('');
    blocks.push(`<ul style="margin:0 0 10px;padding-left:1.3em;">${items}</ul>`);
    listItems = null;
  };

  for (const line of source.split('\n')) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length, 3);
      const top = blocks.length === 0 ? '0' : '12px';
      blocks.push(
        `<h${level} style="font-size:13px;margin:${top} 0 6px;">${renderInlineMarkdown(heading[2])}</h${level}>`,
      );
      continue;
    }
    if (bullet) {
      flushParagraph();
      if (!listItems) listItems = [];
      listItems.push(bullet[1]);
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:13px;line-height:1.5;">${blocks.join('')}</div>`;
}

function sparkleDescription(notes) {
  return markdownToHtml(notes).replaceAll(']]>', ']]]]><![CDATA[>');
}

export function collectLatestFiles(dir, extraFiles = []) {
  const names = new Set();
  const files = [];
  for (const filePath of [...extraFiles, ...walkFiles(dir)]) {
    const name = basename(filePath);
    if (isIgnorableReleaseAsset(name) || names.has(name)) continue;
    names.add(name);
    files.push(filePath);
  }
  return files.sort((a, b) => basename(a).localeCompare(basename(b)));
}

export function buildLatestJson({ tag, htmlUrl, publishedAt, files, assetBaseUrl }) {
  return {
    tag_name: tag.startsWith('v') ? tag : `v${tag}`,
    html_url: htmlUrl,
    published_at: publishedAt,
    assets: files.map((filePath) => {
      const name = basename(filePath);
      return {
        name,
        browser_download_url: assetUrl(tag, name, assetBaseUrl),
        size: statSync(filePath).size,
      };
    }),
  };
}

function enclosureItem({ version, notes, filePath, tag, assetBaseUrl }) {
  const name = basename(filePath);
  const os = detectOs(name);
  if (!os) {
    throw new Error(`无法识别更新包平台: ${name}`);
  }
  const enclosureUrl = assetUrl(tag, name, assetBaseUrl);
  const signed = parseSignature(signUpdate(filePath), filePath);
  return `    <item>
      <title>TinyNote ${escapeXml(version)}</title>
      <pubDate>${rfc822Date()}</pubDate>
      <sparkle:version>${escapeXml(version)}</sparkle:version>
      <sparkle:shortVersionString>${escapeXml(version)}</sparkle:shortVersionString>
      <description><![CDATA[${notes}]]></description>
      <enclosure
        url="${escapeXml(enclosureUrl)}"
        sparkle:edSignature="${signed.signature}"
        length="${signed.length}"
        type="application/octet-stream"
        sparkle:os="${os}"
      />
    </item>`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
  const version = options.version || pkg.version;
  const tag = options.tag || `v${version}`;
  const files = findUpdaterFiles(options.files);
  const notes = sparkleDescription(readNotes(options, version));
  const items = files.map((filePath) => {
    const item = enclosureItem({
      version,
      notes,
      filePath,
      tag,
      assetBaseUrl: options.assetBaseUrl,
    });
    console.log(`Signed ${basename(filePath)}`);
    return item;
  });

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>TinyNote</title>
    <language>en</language>
${items.join('\n')}
  </channel>
</rss>
`;

  writeFileSync(options.out, xml);
  console.log(`Wrote ${options.out}`);

  if (options.latestJson) {
    const latestFiles = options.latestFilesDir
      ? collectLatestFiles(options.latestFilesDir, files)
      : files.filter((filePath) => !isIgnorableReleaseAsset(basename(filePath)));
    const payload = buildLatestJson({
      tag,
      htmlUrl: options.htmlUrl || `https://github.com/${REPO}/releases/tag/${tag}`,
      publishedAt: options.publishedAt || new Date().toISOString(),
      files: latestFiles,
      assetBaseUrl: options.assetBaseUrl,
    });
    writeFileSync(options.latestJson, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`Wrote ${options.latestJson}`);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
