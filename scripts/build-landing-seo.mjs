import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { marked } from 'marked';

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
const contentPages = [
  { id: 'changelog', file: 'changelog.html', zh: 'changelog.md', en: 'en/changelog.md' },
  { id: 'terms', file: 'terms.html', zh: 'terms.md', en: 'en/terms.md' },
  { id: 'privacy', file: 'privacy.html', zh: 'privacy.md', en: 'en/privacy.md' },
  { id: 'refund', file: 'refund.html', zh: 'refund.md', en: 'en/refund.md' },
  { id: 'affiliate', file: 'affiliate.html', zh: 'affiliate.md', en: 'en/affiliate.md' },
  { id: 'faq', file: 'faq.html', zh: 'faq.md', en: 'en/faq.md' },
  { id: 'vs-notion', file: 'vs-notion.html', zh: 'vs-notion.md', en: 'en/vs-notion.md' },
  { id: 'vs-obsidian', file: 'vs-obsidian.html', zh: 'vs-obsidian.md', en: 'en/vs-obsidian.md' },
  { id: 'vs-evernote', file: 'vs-evernote.html', zh: 'vs-evernote.md', en: 'en/vs-evernote.md' },
  { id: 'vs-typora', file: 'vs-typora.html', zh: 'vs-typora.md', en: 'en/vs-typora.md' },
  { id: 'vs-apple-notes', file: 'vs-apple-notes.html', zh: 'vs-apple-notes.md', en: 'en/vs-apple-notes.md' },
];
const contentPageById = new Map(contentPages.map((page) => [page.id, page]));

function routeFor(locale, page) {
  const prefix = locale.path ? `/${locale.path}` : '';
  if (page === 'home') return prefix ? `${prefix}/` : '/';
  if (page === 'download') return `${prefix}/download.html`;
  const contentPage = contentPageById.get(page);
  if (!contentPage) throw new Error(`Unknown landing page: ${page}`);
  return `${prefix}/${contentPage.file}`;
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
    path.join(landingDir, 'js/page-meta.js'),
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
  const descriptionKey = page === 'home' ? 'meta.description' : `${page}.meta.description`;
  const canonical = absoluteUrl(locale, page);
  if (contentPageById.has(page)) {
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: message(messages, locale, `${page}.meta.title`),
      description: message(messages, locale, descriptionKey),
      url: canonical,
      inLanguage: locale.htmlLang,
      isPartOf: { '@type': 'WebSite', name: 'TinyNote', url: siteUrl },
    }).replace(/</g, '\\u003c');
  }
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
  const titleKey = page === 'home' ? 'meta.title' : `${page}.meta.title`;
  const descriptionKey = page === 'home' ? 'meta.description' : `${page}.meta.description`;
  const title = message(messages, locale, titleKey);
  const description = message(messages, locale, descriptionKey);
  const ogTitle = page === 'home' ? message(messages, locale, 'meta.ogTitle') : title;
  const ogDescription = page === 'home' ? message(messages, locale, 'meta.ogDescription') : description;
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

  // The help center currently ships Chinese and English content. Use English
  // as the readable fallback for every non-Chinese landing locale.
  if (locale.id !== 'zh-Hans' && locale.id !== 'zh-Hant') {
    html = html.replace(/href="\/docs\/(?!en\/)/g, 'href="/docs/en/');
  }

  let result = html
    .replace(/(src|href)="(images|css|js)\//g, '$1="/$2/')
    .replace(/href="\/docs\/app"/g, `href="${docsRoute}"`)
    .replace(/href="#"/g, `href="${homeRoute}"`)
    .replace(/href="#([^"]+)"/g, `href="${homeRoute}#$1"`)
    .replace(/href="index\.html#([^"]+)"/g, `href="${homeRoute}#$1"`)
    .replace(/href="index\.html"/g, `href="${homeRoute}"`)
    .replace(/href="download\.html"/g, `href="${downloadRoute}"`)
    .replace(/href="\/download\.html"/g, `href="${downloadRoute}"`);
  for (const page of contentPages) {
    const route = routeFor(locale, page.id);
    result = result
      .replace(new RegExp(`href="${escapeRegExp(page.file)}"`, 'g'), `href="${route}"`)
      .replace(new RegExp(`href="/${escapeRegExp(page.file)}"`, 'g'), `href="${route}"`)
      .replace(new RegExp(`href="/docs/(?:en/)?${escapeRegExp(page.id)}"`, 'g'), `href="${route}"`);
  }
  return result;
}

async function buildLocalePage(source, messages, locale, page) {
  let html = translateDocument(source, messages, locale);
  html = localizeHead(html, messages, locale, page);
  html = localizeLinks(html, locale);
  return html;
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
}

function normalizeContentLinks(html) {
  const officialIds = new Set(contentPages.map((page) => page.id));
  return html.replace(/href="\/(en\/)?([^"#]+)(#[^"]*)?"/g, (_match, englishPrefix, target, hash = '') => {
    const normalized = target.replace(/\.html$/, '');
    if (officialIds.has(normalized)) return `href="${normalized}.html${hash}"`;
    return `href="/docs/${englishPrefix || ''}${target}${hash}"`;
  });
}

async function contentSourceFor(page, locale, template, messages) {
  const useChinese = locale.id === 'zh-Hans' || locale.id === 'zh-Hant';
  const markdownPath = path.join(rootDir, 'docs-site', useChinese ? page.zh : page.en);
  const markdown = stripFrontmatter(await readFile(markdownPath, 'utf8'));
  const localizedTitle = message(messages, locale, `${page.id}.meta.title`).replace(/\s+[—-]\s+TinyNote$/, '');
  const contentHtml = normalizeContentLinks(await marked.parse(markdown))
    .replace(/<h1>[^<]*<\/h1>/, `<h1>${escapeHtml(localizedTitle)}</h1>`);
  return template
    .replaceAll('{{PAGE_ID}}', page.id)
    .replaceAll('{{PAGE_FILE}}', page.file)
    .replaceAll('{{PAGE_TITLE}}', escapeHtml(message(messages, locale, `${page.id}.meta.title`)))
    .replaceAll('{{PAGE_DESCRIPTION}}', escapeHtml(message(messages, locale, `${page.id}.meta.description`)))
    .replace('{{CONTENT_HTML}}', contentHtml);
}

async function updateSitemap() {
  const sitemapPath = path.join(landingDir, 'sitemap.xml');
  const sitemap = await readFile(sitemapPath, 'utf8');
  const lastmod = new Date().toISOString().slice(0, 10);
  const pageIds = ['home', 'download', ...contentPages.map((page) => page.id)];
  const entries = locales.flatMap((locale) => pageIds.map((page) =>
    `  <url><loc>${absoluteUrl(locale, page)}</loc><lastmod>${lastmod}</lastmod></url>`
  )).join('\n');
  const block = `  <!-- localized-landing-pages:start -->\n${entries}\n  <!-- localized-landing-pages:end -->`;
  const markerPattern = /  <!-- localized-landing-pages:start -->[\s\S]*?  <!-- localized-landing-pages:end -->/;
  if (!markerPattern.test(sitemap)) throw new Error('Sitemap localized landing marker block is missing');
  let next = sitemap.replace(markerPattern, block);
  const officialDocsPattern = contentPages.map((page) => escapeRegExp(page.id)).join('|');
  next = next.replace(new RegExp(`\\s*<url><loc>${escapeRegExp(siteUrl)}/docs/(?:en/)?(?:${officialDocsPattern})</loc><lastmod>[^<]+</lastmod></url>`, 'g'), '');
  await writeFile(sitemapPath, next);
}

async function main() {
  const [messages, homeSource, downloadSource, contentTemplate] = await Promise.all([
    loadMessages(),
    readFile(path.join(landingDir, 'index.html'), 'utf8'),
    readFile(path.join(landingDir, 'download.html'), 'utf8'),
    readFile(path.join(rootDir, 'scripts/templates/landing-content-page.html'), 'utf8'),
  ]);

  for (const directory of generatedLocaleDirectories) {
    await rm(path.join(landingDir, directory), { recursive: true, force: true });
  }

  const rootLocale = locales[0];
  for (const page of contentPages) {
    const source = await contentSourceFor(page, rootLocale, contentTemplate, messages);
    await writeFile(path.join(landingDir, page.file), await buildLocalePage(source, messages, rootLocale, page.id));
  }

  for (const locale of locales.filter((item) => item.path)) {
    const outputDirectory = path.join(landingDir, locale.path);
    await mkdir(outputDirectory, { recursive: true });
    const contentOutputs = contentPages.map(async (page) => {
      const source = await contentSourceFor(page, locale, contentTemplate, messages);
      return writeFile(path.join(outputDirectory, page.file), await buildLocalePage(source, messages, locale, page.id));
    });
    await Promise.all([
      writeFile(path.join(outputDirectory, 'index.html'), await buildLocalePage(homeSource, messages, locale, 'home')),
      writeFile(path.join(outputDirectory, 'download.html'), await buildLocalePage(downloadSource, messages, locale, 'download')),
      ...contentOutputs,
    ]);
  }

  await updateSitemap();

  process.stdout.write(`Generated ${locales.length * contentPages.length + generatedLocaleDirectories.length * 2} first-class localized landing pages.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
