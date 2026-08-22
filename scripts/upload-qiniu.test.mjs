import assert from 'node:assert/strict';
import test from 'node:test';

import {
  METADATA_CACHE_CONTROL,
  chgmCacheControlPath,
  makeQboxAuthorization,
  makeUploadToken,
  urlsafeBase64,
} from './upload-qiniu.mjs';

test('upload token is accessKey:sign:policy', () => {
  const token = makeUploadToken('ak', 'sk', 'tinynote', 'updates/appcast.xml', 1_700_000_000_000);
  const [accessKey, sign, policy] = token.split(':');
  assert.equal(accessKey, 'ak');
  assert.ok(sign);
  const decoded = JSON.parse(Buffer.from(policy.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  assert.equal(decoded.scope, 'tinynote:updates/appcast.xml');
  assert.equal(decoded.deadline, 1_700_000_000 + 3600);
});

test('QBox authorization is stable for a known request', () => {
  const auth = makeQboxAuthorization(
    'ak',
    'sk',
    'POST',
    'fusion.qiniuapi.com',
    '/v2/tune/refresh',
    'application/json',
    '{"urls":["https://cdn.example.com/updates/appcast.xml"]}',
  );
  assert.match(auth, /^QBox ak:/);
  assert.equal(urlsafeBase64('hello').includes('+'), false);
  assert.equal(urlsafeBase64('hello').includes('/'), false);
});

test('chgm path encodes bucket key mime and cache control', () => {
  const path = chgmCacheControlPath('tinynote', 'tinynote/updates/latest.json', 'application/json');
  assert.equal(path.startsWith('/chgm/'), true);
  assert.equal(path.includes('/mime/'), true);
  assert.equal(path.includes('/cacheControl/'), true);
  assert.equal(path.includes(urlsafeBase64('tinynote:tinynote/updates/latest.json')), true);
  assert.equal(path.includes(urlsafeBase64(METADATA_CACHE_CONTROL)), true);
});
