import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const key = process.env.INDEXNOW_KEY;
if (!key || !/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  throw new Error('Set INDEXNOW_KEY before submitting URLs.');
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sitemap = await readFile(path.join(rootDir, 'landing', 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>(https:\/\/tinynote\.wu2kong\.com[^<]+)<\/loc>/g)].map((match) => match[1]);
if (!urlList.length) throw new Error('No URLs found in landing/sitemap.xml.');

const response = await fetch('https://www.bing.com/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: 'tinynote.wu2kong.com',
    key,
    keyLocation: `https://tinynote.wu2kong.com/${key}.txt`,
    urlList,
  }),
});

if (!response.ok) throw new Error(`IndexNow submission failed (${response.status}): ${await response.text()}`);
process.stdout.write(`Submitted ${urlList.length} URLs to Bing IndexNow.\n`);
