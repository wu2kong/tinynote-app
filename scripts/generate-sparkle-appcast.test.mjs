import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import test from 'node:test';

import { buildLatestJson, collectLatestFiles } from './generate-sparkle-appcast.mjs';

const dir = join(tmpdir(), `tinynote-appcast-test-${process.pid}`);

test('latest.json points installers at the requested host and skips metadata', () => {
  mkdirSync(dir, { recursive: true });
  const dmg = join(dir, 'TinyNote_1.2.3_universal.dmg');
  const exe = join(dir, 'TinyNote_1.2.3_x64-setup.exe');
  writeFileSync(dmg, 'dmg');
  writeFileSync(exe, 'exe-bytes');
  writeFileSync(join(dir, 'appcast.xml'), '<rss/>');
  writeFileSync(join(dir, 'latest.json'), '{}');

  const files = collectLatestFiles(dir);
  assert.deepEqual(
    files.map((filePath) => filePath.split(/[/\\]/).pop()),
    ['TinyNote_1.2.3_universal.dmg', 'TinyNote_1.2.3_x64-setup.exe'],
  );

  const payload = buildLatestJson({
    tag: 'v1.2.3',
    htmlUrl: 'https://github.com/wu2kong/tinynote-app/releases/tag/v1.2.3',
    publishedAt: '2026-08-22T00:00:00Z',
    files,
    assetBaseUrl: 'https://qin.wu2kong.com/tinynote',
  });

  assert.equal(payload.tag_name, 'v1.2.3');
  assert.equal(
    payload.assets[0].browser_download_url,
    'https://qin.wu2kong.com/tinynote/releases/TinyNote_1.2.3_universal.dmg',
  );
  assert.equal(payload.assets[0].size, 3);
  assert.equal(
    payload.assets[1].browser_download_url,
    'https://qin.wu2kong.com/tinynote/releases/TinyNote_1.2.3_x64-setup.exe',
  );

  rmSync(dir, { recursive: true, force: true });
});
