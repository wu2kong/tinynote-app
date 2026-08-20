#!/usr/bin/env node

/**
 * Sign a macOS DMG with Sparkle EdDSA and write appcast.xml.
 *
 * Usage:
 *   node scripts/generate-sparkle-appcast.mjs [dmg-path]
 *     [--version x.y.z] [--tag vX.Y.Z] [--notes "..."] [--notes-file path]
 *     [--url enclosure-url] [--out appcast.xml]
 *
 * Signing key (first match wins):
 *   1. SPARKLE_PRIVATE_KEY env (CI)
 *   2. src-tauri/sparkle_eddsa_private.key
 *   3. macOS Keychain account tinynote-app
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
const PRIVATE_KEY_FILE = join(ROOT, 'src-tauri', 'sparkle_eddsa_private.key');
const PACKAGE_JSON = join(ROOT, 'package.json');
const DEFAULT_OUT = join(ROOT, 'appcast.xml');

function parseArgs(argv) {
  const options = {
    dmg: '',
    version: '',
    tag: '',
    notes: '',
    notesFile: '',
    url: '',
    out: DEFAULT_OUT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--') && !options.dmg) {
      options.dmg = arg;
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
        options.url = value;
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

function findDmg(explicit) {
  if (explicit) {
    const path = explicit.startsWith('/') ? explicit : join(ROOT, explicit);
    if (!existsSync(path)) {
      throw new Error(`找不到 DMG: ${path}`);
    }
    return path;
  }

  const candidates = walkFiles(join(ROOT, 'src-tauri', 'target'))
    .filter((filePath) => /\.dmg$/i.test(filePath))
    .filter((filePath) => filePath.split(/[/\\]/).join('/').includes('/release/bundle/dmg/'))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  if (!candidates.length) {
    throw new Error('未找到 macOS DMG，请先构建或传入路径。');
  }
  return candidates[0];
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

function signUpdate(dmgPath) {
  if (!existsSync(SIGN_UPDATE)) {
    throw new Error('未找到 Sparkle 工具。请先运行: ./scripts/download-sparkle.sh');
  }

  const envKey = process.env.SPARKLE_PRIVATE_KEY?.trim();
  if (envKey) {
    const result = spawnSync(SIGN_UPDATE, ['--ed-key-file', '-', dmgPath], {
      input: `${envKey}\n`,
      encoding: 'utf-8',
    });
    if (result.status !== 0) {
      throw new Error(`sign_update 失败: ${result.stderr || result.stdout || result.status}`);
    }
    return result.stdout.trim();
  }

  if (existsSync(PRIVATE_KEY_FILE)) {
    return execFileSync(SIGN_UPDATE, ['--ed-key-file', PRIVATE_KEY_FILE, dmgPath], {
      encoding: 'utf-8',
    }).trim();
  }

  return execFileSync(SIGN_UPDATE, ['--account', SPARKLE_ACCOUNT, dmgPath], {
    encoding: 'utf-8',
  }).trim();
}

function parseSignature(output) {
  const signature = output.match(/sparkle:edSignature="([^"]+)"/)?.[1];
  const length = output.match(/length="(\d+)"/)?.[1];
  if (!signature || !length) {
    throw new Error(`无法解析 sign_update 输出:\n${output}`);
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

function main() {
  const options = parseArgs(process.argv.slice(2));
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
  const version = options.version || pkg.version;
  const tag = options.tag || `v${version}`;
  const dmgPath = findDmg(options.dmg);
  const dmgName = basename(dmgPath);
  const enclosureUrl = options.url
    || `https://github.com/${REPO}/releases/download/${tag}/${dmgName}`;
  const notes = readNotes(options, version).replaceAll(']]>', ']]]]><![CDATA[>');
  const signed = parseSignature(signUpdate(dmgPath));

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>TinyNote</title>
    <language>en</language>
    <item>
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
        sparkle:os="macos"
      />
    </item>
  </channel>
</rss>
`;

  writeFileSync(options.out, xml);
  console.log(`Signed ${dmgName}`);
  console.log(`Wrote ${options.out}`);
  console.log(`Enclosure ${enclosureUrl}`);
}

main();
