import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const landingDir = path.join(rootDir, 'landing');
const siteUrl = 'https://tinynote.wu2kong.com';
const locales = [
  { path: '', hreflang: 'zh-CN', htmlLang: 'zh-CN' },
  { path: 'zh-hant', hreflang: 'zh-TW', htmlLang: 'zh-TW' },
  { path: 'en', hreflang: 'en', htmlLang: 'en' },
  { path: 'ja', hreflang: 'ja', htmlLang: 'ja' },
  { path: 'ko', hreflang: 'ko', htmlLang: 'ko' },
  { path: 'de', hreflang: 'de', htmlLang: 'de' },
  { path: 'fr', hreflang: 'fr', htmlLang: 'fr' },
  { path: 'it', hreflang: 'it', htmlLang: 'it' },
  { path: 'ru', hreflang: 'ru', htmlLang: 'ru' },
];
const contentPages = ['changelog', 'terms', 'privacy', 'refund', 'affiliate', 'faq', 'vs-notion', 'vs-obsidian', 'vs-evernote', 'vs-typora', 'vs-apple-notes'];

function routeFor(locale, page) {
  const prefix = locale.path ? `/${locale.path}` : '';
  if (page === 'home') return prefix ? `${prefix}/` : '/';
  return `${prefix}/${page}.html`;
}

async function assertFile(filePath) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Missing generated file: ${path.relative(rootDir, filePath)}`);
  }
}

async function verifyPage(locale, page, sitemap) {
  const route = routeFor(locale, page);
  const filePath = path.join(landingDir, locale.path, page === 'home' ? 'index.html' : `${page}.html`);
  await assertFile(filePath);
  const html = await readFile(filePath, 'utf8');
  const url = `${siteUrl}${route}`;

  const required = [
    `<html lang="${locale.htmlLang}"`,
    `<link rel="canonical" href="${url}" />`,
    '<script id="software-application-jsonld" type="application/ld+json">',
    '<meta name="twitter:card" content="summary_large_image" />',
  ];
  for (const fragment of required) {
    if (!html.includes(fragment)) throw new Error(`${route} is missing: ${fragment}`);
  }

  for (const alternate of locales) {
    const alternateUrl = `${siteUrl}${routeFor(alternate, page)}`;
    const tag = `<link rel="alternate" hreflang="${alternate.hreflang}" href="${alternateUrl}" />`;
    if (!html.includes(tag)) throw new Error(`${route} is missing alternate URL: ${alternateUrl}`);
  }

  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Sitemap is missing: ${url}`);
}

async function main() {
  const sitemap = await readFile(path.join(landingDir, 'sitemap.xml'), 'utf8');
  for (const locale of locales) {
    for (const page of ['home', 'download', ...contentPages]) await verifyPage(locale, page, sitemap);
  }

  for (const page of ['app', 'quickstart', 'organize', 'settings', 'sync', 'backup', 'ai', 'pro']) {
    for (const locale of ['', 'en']) {
      const pathPart = locale ? `en/${page}` : page;
      const html = await readFile(path.join(landingDir, 'docs', locale, `${page}.html`), 'utf8');
      const canonical = `${siteUrl}/docs/${pathPart}`;
      if (!html.includes(`<link rel="canonical" href="${canonical}">`)) throw new Error(`Documentation canonical is missing: ${canonical}`);
      if (!html.includes('hreflang="zh-CN"') || !html.includes('hreflang="en"')) throw new Error(`Documentation hreflang links are missing: ${canonical}`);
    }
  }

  process.stdout.write('Landing SEO verification passed.\n');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
