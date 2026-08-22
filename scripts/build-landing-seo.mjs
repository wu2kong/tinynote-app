import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const landingDir = path.join(rootDir, 'landing');
const siteUrl = 'https://tinynote.wu2kong.com';

const locales = [
  { id: 'zh-Hans', path: '', hreflang: 'zh-CN', htmlLang: 'zh-CN' },
  { id: 'zh-Hant', path: 'zh-hant', hreflang: 'zh-TW', htmlLang: 'zh-TW' },
  { id: 'en', path: 'en', hreflang: 'en', htmlLang: 'en' },
  { id: 'ja', path: 'ja', hreflang: 'ja', htmlLang: 'ja' },
  { id: 'ko', path: 'ko', hreflang: 'ko', htmlLang: 'ko' },
  { id: 'de', path: 'de', hreflang: 'de', htmlLang: 'de' },
  { id: 'fr', path: 'fr', hreflang: 'fr', htmlLang: 'fr' },
  { id: 'it', path: 'it', hreflang: 'it', htmlLang: 'it' },
  { id: 'ru', path: 'ru', hreflang: 'ru', htmlLang: 'ru' },
];

const generatedLocaleDirectories = locales.filter((locale) => locale.path).map((locale) => locale.path);

function routeFor(locale, page) {
  const prefix = locale.path ? `/${locale.path}` : '';
  return page === 'download' ? `${prefix}/download.html` : (prefix ? `${prefix}/` : '/');
}

function absoluteUrl(locale, page) {
  return `${siteUrl}${routeFor(locale, page)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadMessages() {
  const context = { window: {} };
  vm.createContext(context);
  const sources = [
    path.join(landingDir, 'js/i18n-meta.js'),
    ...locales.map((locale) => path.join(landingDir, `js/locales/${locale.id}.js`)),
  ];

  for (const source of sources) {
    vm.runInContext(await readFile(source, 'utf8'), context, { filename: source });
  }

  return context.window.TINYNOTE_LANDING_I18N.messages;
}

function message(messages, locale, key) {
  return messages[locale.id]?.[key] ?? messages['zh-Hans'][key] ?? key;
}

function replaceAttribute(tag, attribute, value) {
  const expression = new RegExp(`(\\s${escapeRegExp(attribute)}\\s*=\\s*)(["'])[^"']*\\2`, 'i');
  if (expression.test(tag)) {
    return tag.replace(expression, (_, prefix, quote) => `${prefix}${quote}${escapeHtml(value)}${quote}`);
  }
  return tag.replace(/\s*\/>$|>$/, (ending) => ` ${attribute}="${escapeHtml(value)}"${ending}`);
}

function translateDocument(html, messages, locale) {
  let result = html.replace(/<[^>]+\sdata-i18n-attr="([^"]+)"[^>]*>/g, (tag, mapping) => {
    return mapping.split(';').reduce((updatedTag, entry) => {
      const separator = entry.indexOf(':');
      if (separator === -1) return updatedTag;
      const attribute = entry.slice(0, separator).trim();
      const key = entry.slice(separator + 1).trim();
      return attribute && key ? replaceAttribute(updatedTag, attribute, message(messages, locale, key)) : updatedTag;
    }, tag);
  });

  result = result.replace(/(<([a-z][\w:-]*)(?:\s[^>]*)?\sdata-i18n-html="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/gi, (_, open, _tag, key, _content, close) => {
    return `${open}${message(messages, locale, key)}${close}`;
  });

  return result.replace(/(<([a-z][\w:-]*)(?:\s[^>]*)?\sdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/gi, (_, open, _tag, key, _content, close) => {
    return `${open}${escapeHtml(message(messages, locale, key))}${close}`;
  });
}

function alternateLinks(page) {
  const links = locales.map((locale) => `  <link rel="alternate" hreflang="${locale.hreflang}" href="${absoluteUrl(locale, page)}" />`);
  links.push(`  <link rel="alternate" hreflang="x-default" href="${absoluteUrl(locales[0], page)}" />`);
  return links.join('\n');
}

function structuredData(messages, locale, page) {
  const descriptionKey = page === 'download' ? 'download.meta.description' : 'meta.description';
  const canonical = absoluteUrl(locale, page);
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'TinyNote',
        url: siteUrl,
        inLanguage: locale.htmlLang,
      },
      {
        '@type': 'SoftwareApplication',
        name: 'TinyNote',
        alternateName: 'TinyNote 轻记',
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'macOS, Windows, Linux',
        description: message(messages, locale, descriptionKey),
        url: canonical,
        downloadUrl: absoluteUrl(locale, 'download'),
        image: `${siteUrl}/images/icon-512.png`,
      },
    ],
  }).replace(/</g, '\\u003c');
}

function localizeHead(html, messages, locale, page) {
  const titleKey = page === 'download' ? 'download.meta.title' : 'meta.title';
  const descriptionKey = page === 'download' ? 'download.meta.description' : 'meta.description';
  const title = message(messages, locale, titleKey);
  const description = message(messages, locale, descriptionKey);
  const ogTitle = page === 'download' ? title : message(messages, locale, 'meta.ogTitle');
  const ogDescription = page === 'download' ? description : message(messages, locale, 'meta.ogDescription');
  const canonical = absoluteUrl(locale, page);

  let result = html
    .replace(/<html lang="[^"]+"/, `<html lang="${locale.htmlLang}"`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<meta name="keywords" content="[^"]*"\s*\/>/, `<meta name="keywords" content="${escapeHtml(message(messages, locale, 'meta.keywords'))}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/>/, `<meta property="og:image" content="${siteUrl}/images/icon-512.png" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta name="twitter:card" content="[^"]*"\s*\/>\n?/g, '')
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>\n?/g, '')
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/>\n?/g, '')
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/>\n?/g, '')
    .replace(/<script id="software-application-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/, `<script id="software-application-jsonld" type="application/ld+json">${structuredData(messages, locale, page)}</script>`);

  const seoBlock = `${alternateLinks(page)}\n  <meta name="twitter:card" content="summary_large_image" />\n  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />\n  <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />\n  <meta name="twitter:image" content="${siteUrl}/images/icon-512.png" />`;
  return result.replace(/\s*<!-- localized-seo-links:start -->[\s\S]*?<!-- localized-seo-links:end -->/, `\n${seoBlock}`);
}

function localizeLinks(html, locale) {
  const homeRoute = routeFor(locale, 'home');
  const downloadRoute = routeFor(locale, 'download');
  const docsRoute = locale.id === 'en' ? '/docs/en/app' : '/docs/app';

  if (locale.id === 'en') {
    html = html.replace(/href="\/docs\/(?!en\/)/g, 'href="/docs/en/');
  }

  return html
    .replace(/(src|href)="(images|css|js)\//g, '$1="/$2/')
    .replace(/href="\/docs\/app"/g, `href="${docsRoute}"`)
    .replace(/href="#"/g, `href="${homeRoute}"`)
    .replace(/href="#([^"]+)"/g, `href="${homeRoute}#$1"`)
    .replace(/href="index\.html#([^"]+)"/g, `href="${homeRoute}#$1"`)
    .replace(/href="index\.html"/g, `href="${homeRoute}"`)
    .replace(/href="download\.html"/g, `href="${downloadRoute}"`)
    .replace(/href="\/download\.html"/g, `href="${downloadRoute}"`);
}

async function buildLocalePage(source, messages, locale, page) {
  let html = translateDocument(source, messages, locale);
  html = localizeHead(html, messages, locale, page);
  html = localizeLinks(html, locale);
  return html;
}

async function main() {
  const [messages, homeSource, downloadSource] = await Promise.all([
    loadMessages(),
    readFile(path.join(landingDir, 'index.html'), 'utf8'),
    readFile(path.join(landingDir, 'download.html'), 'utf8'),
  ]);

  for (const directory of generatedLocaleDirectories) {
    await rm(path.join(landingDir, directory), { recursive: true, force: true });
  }

  for (const locale of locales.filter((item) => item.path)) {
    const outputDirectory = path.join(landingDir, locale.path);
    await mkdir(outputDirectory, { recursive: true });
    await Promise.all([
      writeFile(path.join(outputDirectory, 'index.html'), await buildLocalePage(homeSource, messages, locale, 'home')),
      writeFile(path.join(outputDirectory, 'download.html'), await buildLocalePage(downloadSource, messages, locale, 'download')),
    ]);
  }

  process.stdout.write(`Generated ${generatedLocaleDirectories.length * 2} localized landing pages.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
