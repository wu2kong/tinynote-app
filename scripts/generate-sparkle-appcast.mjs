#!/usr/bin/env node

/**
 * Sign macOS DMG / Windows NSIS installer with Sparkle-compatible EdDSA
 * and write a combined appcast.xml.
 *
 * Usage:
 *   node scripts/generate-sparkle-appcast.mjs [file ...]
 *     [--version x.y.z] [--tag vX.Y.Z] [--notes "..."] [--notes-file path]
 *     [--out appcast.xml]
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
import { fileURLToPath } from 'url';
import { execFileSync, spawnSync } from 'child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'wu2kong/tinynote-app';
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
        i += 1;
        break;
      case '--out':
        options.out = value;
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

function enclosureItem({ version, notes, filePath, tag }) {
  const name = basename(filePath);
  const os = detectOs(name);
  if (!os) {
    throw new Error(`无法识别更新包平台: ${name}`);
  }
  const enclosureUrl = `https://github.com/${REPO}/releases/download/${tag}/${name}`;
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
  const notes = readNotes(options, version).replaceAll(']]>', ']]]]><![CDATA[>');
  const items = files.map((filePath) => {
    const item = enclosureItem({ version, notes, filePath, tag });
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
}

main();
