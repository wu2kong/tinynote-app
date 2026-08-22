import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assetUrl,
  forcedUpdateSource,
  githubAppcastUrl,
  githubAssetUrl,
  isIgnorableReleaseAsset,
  normalizeCdnBase,
  qiniuAppcastKey,
  qiniuAppcastUrl,
  qiniuAssetUrl,
  qiniuLatestJsonKey,
  qiniuLatestJsonUrl,
  qiniuObjectKey,
  updateSourceOrder,
} from './update-sources.mjs';

test('Qiniu CDN matches the public tinynote path', () => {
  assert.equal(normalizeCdnBase('https://qin.wu2kong.com'), 'https://qin.wu2kong.com/tinynote');
  assert.equal(normalizeCdnBase('https://qin.wu2kong.com/tinynote/'), 'https://qin.wu2kong.com/tinynote');
  assert.equal(
    qiniuAssetUrl('v1.2.3', 'TinyNote_1.2.3_universal.dmg'),
    'https://qin.wu2kong.com/tinynote/releases/TinyNote_1.2.3_universal.dmg',
  );
  assert.equal(
    qiniuObjectKey('TinyNote_1.2.3_universal.dmg'),
    'tinynote/releases/TinyNote_1.2.3_universal.dmg',
  );
  assert.equal(qiniuAppcastKey(), 'tinynote/updates/appcast.xml');
  assert.equal(qiniuLatestJsonKey(), 'tinynote/updates/latest.json');
  assert.equal(qiniuAppcastUrl(), 'https://qin.wu2kong.com/tinynote/updates/appcast.xml');
  assert.equal(qiniuLatestJsonUrl(), 'https://qin.wu2kong.com/tinynote/updates/latest.json');
});

test('GitHub stays first unless testing forces Qiniu', () => {
  assert.deepEqual(updateSourceOrder('github', 'qiniu'), ['github', 'qiniu']);
  assert.deepEqual(updateSourceOrder('github', 'qiniu', 'auto'), ['github', 'qiniu']);
  assert.deepEqual(updateSourceOrder('github', 'qiniu', 'qiniu'), ['qiniu', 'github']);
  assert.deepEqual(updateSourceOrder('github', 'qiniu', 'github'), ['github']);
  assert.equal(forcedUpdateSource({}), 'auto');
  assert.equal(forcedUpdateSource({ TINYNOTE_UPDATE_SOURCE: 'qiniu' }), 'qiniu');
});

test('asset URLs stay on the requested host', () => {
  assert.equal(
    githubAssetUrl('v1.2.3', 'TinyNote_1.2.3_universal.dmg'),
    'https://github.com/wu2kong/tinynote-app/releases/download/v1.2.3/TinyNote_1.2.3_universal.dmg',
  );
  assert.equal(assetUrl('v1.2.3', 'app.dmg'), githubAssetUrl('v1.2.3', 'app.dmg'));
  assert.equal(
    assetUrl('v1.2.3', 'app.dmg', 'https://qin.wu2kong.com/tinynote'),
    'https://qin.wu2kong.com/tinynote/releases/app.dmg',
  );
  assert.equal(
    githubAppcastUrl(),
    'https://github.com/wu2kong/tinynote-app/releases/latest/download/appcast.xml',
  );
});

test('release metadata files are not treated as installers', () => {
  assert.equal(isIgnorableReleaseAsset('appcast.xml'), true);
  assert.equal(isIgnorableReleaseAsset('latest.json'), true);
  assert.equal(isIgnorableReleaseAsset('TinyNote_1.2.3_universal.dmg'), false);
  assert.equal(isIgnorableReleaseAsset('TinyNote_1.2.3_amd64.AppImage'), true);
});
