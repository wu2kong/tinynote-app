#!/usr/bin/env node

/**
 * Upload TinyNote installers + China appcast to Qiniu Kodo.
 *
 * Required env:
 *   QINIU_ACCESS_KEY
 *   QINIU_SECRET_KEY
 *   QINIU_BUCKET
 *   QINIU_CDN_BASE          e.g. https://qin.wu2kong.com/tinynote
 *   TAG                     e.g. v1.2.3
 *
 * Optional env:
 *   QINIU_UPLOAD_HOST       default https://upload.qiniup.com
 *                           华东 z0: https://upload.qiniup.com
 *                           华北 z1: https://upload-z1.qiniup.com
 *                           华南 z2: https://upload-z2.qiniup.com
 *
 * Usage:
 *   node scripts/upload-qiniu.mjs --dir release-assets --appcast appcast-cn.xml --latest latest.json
 *
 * Bucket must be public. Bind QINIU_CDN_BASE as a custom HTTPS domain and
 * allow GET CORS from https://tinynote.wu2kong.com (and * if needed).
 */

import { createHmac } from 'crypto';
import { readFileSync, readdirSync, statSync } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
  isIgnorableReleaseAsset,
  normalizeCdnBase,
  qiniuAppcastKey,
  qiniuAppcastUrl,
  qiniuLatestJsonKey,
  qiniuLatestJsonUrl,
  qiniuObjectKey,
} from './lib/update-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function urlsafeBase64(data) {
  return Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

export function makeUploadToken(accessKey, secretKey, bucket, key, now = Date.now()) {
  const policy = {
    scope: `${bucket}:${key}`,
    deadline: Math.floor(now / 1000) + 3600,
  };
  const encoded = urlsafeBase64(JSON.stringify(policy));
  const sign = urlsafeBase64(createHmac('sha1', secretKey).update(encoded).digest());
  return `${accessKey}:${sign}:${encoded}`;
}

export function makeQboxAuthorization(accessKey, secretKey, method, host, path, contentType, body) {
  const signingStr = `${method} ${path}\nHost: ${host}\nContent-Type: ${contentType}\n\n${body}`;
  const sign = urlsafeBase64(createHmac('sha1', secretKey).update(signingStr).digest());
  return `QBox ${accessKey}:${sign}`;
}

function parseArgs(argv) {
  const options = { dir: '', appcast: '', latest: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];
    switch (arg) {
      case '--dir':
        options.dir = value;
        i += 1;
        break;
      case '--appcast':
        options.appcast = value;
        i += 1;
        break;
      case '--latest':
        options.latest = value;
        i += 1;
        break;
      default:
        throw new Error(`未知参数: ${arg}`);
    }
  }
  return options;
}

function resolvePath(explicit) {
  if (!explicit) return '';
  return explicit.startsWith('/') || /^[A-Za-z]:[\\/]/.test(explicit)
    ? explicit
    : join(ROOT, explicit);
}

function listInstallerFiles(dir) {
  if (!dir) return [];
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((filePath) => statSync(filePath).isFile())
    .filter((filePath) => !isIgnorableReleaseAsset(basename(filePath)));
}

async function uploadObject({ uploadHost, accessKey, secretKey, bucket, key, bytes, filename }) {
  const token = makeUploadToken(accessKey, secretKey, bucket, key);
  const form = new FormData();
  form.append('token', token);
  form.append('key', key);
  form.append('file', new Blob([bytes]), filename);

  const response = await fetch(uploadHost, { method: 'POST', body: form });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`上传 ${key} 失败（HTTP ${response.status}）: ${detail}`);
  }
  console.log(`Uploaded ${key}`);
}

async function refreshCdn(accessKey, secretKey, urls) {
  const host = 'fusion.qiniuapi.com';
  const path = '/v2/tune/refresh';
  const contentType = 'application/json';
  const body = JSON.stringify({ urls });
  const authorization = makeQboxAuthorization(
    accessKey,
    secretKey,
    'POST',
    host,
    path,
    contentType,
    body,
  );
  const response = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
    },
    body,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`刷新 CDN 失败（HTTP ${response.status}）: ${detail}`);
  }
  console.log(`Refreshed ${urls.length} CDN URL(s)`);
}

export async function uploadReleaseToQiniu(options, env = process.env) {
  const accessKey = env.QINIU_ACCESS_KEY?.trim();
  const secretKey = env.QINIU_SECRET_KEY?.trim();
  const bucket = env.QINIU_BUCKET?.trim();
  const cdnBase = normalizeCdnBase(env.QINIU_CDN_BASE);
  const uploadHost = (env.QINIU_UPLOAD_HOST || 'https://upload.qiniup.com').replace(/\/+$/, '');
  const tag = env.TAG?.trim();

  if (!accessKey || !secretKey || !bucket || !cdnBase || !tag) {
    throw new Error('缺少 QINIU_ACCESS_KEY / QINIU_SECRET_KEY / QINIU_BUCKET / QINIU_CDN_BASE / TAG');
  }

  const uploads = [];
  for (const filePath of listInstallerFiles(options.dir)) {
    const filename = basename(filePath);
    uploads.push({
      key: qiniuObjectKey(filename, cdnBase),
      bytes: readFileSync(filePath),
      filename,
    });
  }
  if (options.appcast) {
    uploads.push({
      key: qiniuAppcastKey(cdnBase),
      bytes: readFileSync(options.appcast),
      filename: 'appcast.xml',
    });
  }
  if (options.latest) {
    uploads.push({
      key: qiniuLatestJsonKey(cdnBase),
      bytes: readFileSync(options.latest),
      filename: 'latest.json',
    });
  }
  if (!uploads.length) {
    throw new Error('没有可上传到七牛云的文件');
  }

  for (const item of uploads) {
    await uploadObject({
      uploadHost,
      accessKey,
      secretKey,
      bucket,
      ...item,
    });
  }

  const refreshUrls = [];
  if (options.appcast) refreshUrls.push(qiniuAppcastUrl(cdnBase));
  if (options.latest) refreshUrls.push(qiniuLatestJsonUrl(cdnBase));
  if (refreshUrls.length) {
    try {
      await refreshCdn(accessKey, secretKey, refreshUrls);
    } catch (error) {
      console.warn(error instanceof Error ? error.message : String(error));
    }
  }
}

async function main() {
  const raw = parseArgs(process.argv.slice(2));
  const options = {
    dir: resolvePath(raw.dir),
    appcast: resolvePath(raw.appcast),
    latest: resolvePath(raw.latest),
  };
  await uploadReleaseToQiniu(options);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
