(function () {
  var STORAGE_KEY = 'tinynote-landing-locale';
  var catalog = window.TINYNOTE_LANDING_I18N || { locales: [], messages: {}, defaultLocale: 'zh-Hans' };
  var currentLocale = catalog.defaultLocale || 'zh-Hans';
  var LOCALE_PATHS = {
    'zh-Hans': '',
    'zh-Hant': 'zh-hant',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
    de: 'de',
    fr: 'fr',
    it: 'it',
    ru: 'ru'
  };
  // Time zone is only a fallback when the browser's preferred languages do
  // not match a supported locale. A time zone can be affected by travel or
  // user settings, so it must never take precedence over an explicit choice.
  var TIME_ZONE_LOCALES = {
    'Asia/Shanghai': 'zh-Hans',
    'Asia/Chongqing': 'zh-Hans',
    'Asia/Urumqi': 'zh-Hans',
    'Asia/Taipei': 'zh-Hant',
    'Asia/Hong_Kong': 'zh-Hant',
    'Asia/Macau': 'zh-Hant',
    'Asia/Tokyo': 'ja',
    'Asia/Seoul': 'ko',
    'Europe/Berlin': 'de',
    'Europe/Vienna': 'de',
    'Europe/Zurich': 'de',
    'Europe/Vaduz': 'de',
    'Europe/Luxembourg': 'de',
    'Europe/Paris': 'fr',
    'Europe/Brussels': 'fr',
    'Europe/Monaco': 'fr',
    'Europe/Rome': 'it',
    'Europe/San_Marino': 'it',
    'Europe/Vatican': 'it',
    'Europe/Moscow': 'ru',
    'Europe/Kirov': 'ru',
    'Europe/Volgograd': 'ru',
    'Asia/Yekaterinburg': 'ru',
    'Asia/Omsk': 'ru',
    'Asia/Novosibirsk': 'ru',
    'Asia/Barnaul': 'ru',
    'Asia/Tomsk': 'ru',
    'Asia/Novokuznetsk': 'ru',
    'Asia/Krasnoyarsk': 'ru',
    'Asia/Irkutsk': 'ru',
    'Asia/Chita': 'ru',
    'Asia/Yakutsk': 'ru',
    'Asia/Vladivostok': 'ru',
    'Asia/Magadan': 'ru',
    'Asia/Sakhalin': 'ru',
    'Asia/Srednekolymsk': 'ru',
    'Asia/Kamchatka': 'ru',
    'Asia/Anadyr': 'ru',
    'Europe/London': 'en',
    'Europe/Dublin': 'en',
    'America/New_York': 'en',
    'America/Chicago': 'en',
    'America/Denver': 'en',
    'America/Los_Angeles': 'en',
    'America/Anchorage': 'en',
    'Pacific/Honolulu': 'en',
    'America/Toronto': 'en',
    'America/Vancouver': 'en',
    'Australia/Sydney': 'en',
    'Australia/Melbourne': 'en',
    'Australia/Brisbane': 'en',
    'Australia/Perth': 'en',
    'Pacific/Auckland': 'en'
  };

  function getMessages(locale) {
    var all = catalog.messages || {};
    return all[locale] || all[catalog.defaultLocale] || all.en || {};
  }

  function interpolate(template, params) {
    if (!params) return template;
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : '{' + key + '}';
    });
  }

  function t(key, params) {
    var primary = getMessages(currentLocale);
    var fallback = getMessages(catalog.defaultLocale || 'zh-Hans');
    var en = getMessages('en');
    var value = primary[key] || fallback[key] || en[key] || key;
    return interpolate(value, params);
  }

  function matchLocale(tag) {
    if (!tag) return null;
    var normalized = String(tag).trim().replace(/_/g, '-');
    var locales = catalog.locales || [];
    for (var i = 0; i < locales.length; i++) {
      if (locales[i].id.toLowerCase() === normalized.toLowerCase()) return locales[i].id;
    }
    var lower = normalized.toLowerCase();
    if (lower === 'zh-hans' || lower.indexOf('zh-hans-') === 0) return 'zh-Hans';
    if (lower === 'zh-hant' || lower.indexOf('zh-hant-') === 0) return 'zh-Hant';
    if (lower === 'zh' || lower.indexOf('zh-') === 0) {
      if (/^zh-(tw|hk|mo)(-|$)/i.test(normalized)) return 'zh-Hant';
      return 'zh-Hans';
    }
    var lang = lower.split('-')[0];
    for (var j = 0; j < locales.length; j++) {
      if (locales[j].id.toLowerCase() === lang || locales[j].id.toLowerCase().indexOf(lang + '-') === 0) {
        return locales[j].id;
      }
    }
    return null;
  }

  function localeFromPathname(pathname) {
    var normalized = String(pathname || '/').replace(/^\/+|\/+$/g, '');
    // The root route is intentionally not treated as an explicit Chinese
    // route. This lets a first-time visitor be matched from browser language.
    if (!normalized || normalized === 'index.html' || normalized === 'download.html') return null;
    var firstSegment = normalized.split('/')[0].toLowerCase();
    for (var locale in LOCALE_PATHS) {
      if (Object.prototype.hasOwnProperty.call(LOCALE_PATHS, locale) && LOCALE_PATHS[locale] === firstSegment) {
        return locale;
      }
    }
    return null;
  }

  function isRootLandingPath(pathname) {
    var normalized = String(pathname || '/').replace(/^\/+|\/+$/g, '');
    return !normalized || normalized === 'index.html' || normalized === 'download.html';
  }

  function localePath(locale) {
    var segment = LOCALE_PATHS[locale] || '';
    var isDownload = document.documentElement.getAttribute('data-i18n-page') === 'download';
    if (isDownload) return (segment ? '/' + segment : '') + '/download.html';
    return segment ? '/' + segment + '/' : '/';
  }

  function localeFromTimeZone() {
    try {
      if (typeof Intl === 'undefined' || !Intl.DateTimeFormat) return null;
      var timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return TIME_ZONE_LOCALES[timeZone] || null;
    } catch (_) {
      return null;
    }
  }

  function detectLocale() {
    var params = new URLSearchParams(window.location.search);
    var fromQuery = matchLocale(params.get('lang') || params.get('locale'));
    if (fromQuery) return fromQuery;

    var fromPath = localeFromPathname(window.location.pathname);
    if (fromPath) return fromPath;

    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      var fromStore = matchLocale(stored);
      if (fromStore) return fromStore;
    } catch (_) {}

    var candidates = [];
    if (typeof navigator !== 'undefined') {
      if (Array.isArray(navigator.languages)) candidates = candidates.concat(navigator.languages);
      if (navigator.language) candidates.push(navigator.language);
    }
    for (var i = 0; i < candidates.length; i++) {
      var matched = matchLocale(candidates[i]);
      if (matched) return matched;
    }
    var fromTimeZone = localeFromTimeZone();
    if (fromTimeZone) return fromTimeZone;
    return catalog.defaultLocale || 'zh-Hans';
  }

  function setMeta(selector, attr, value) {
    var el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  }

  function applyMeta() {
    var page = document.documentElement.getAttribute('data-i18n-page');
    var titleKey = page ? page + '.meta.title' : 'meta.title';
    var descKey = page ? page + '.meta.description' : 'meta.description';
    document.title = t(titleKey);
    setMeta('meta[name="description"]', 'content', t(descKey));
    if (!page) {
      setMeta('meta[name="keywords"]', 'content', t('meta.keywords'));
      setMeta('meta[property="og:title"]', 'content', t('meta.ogTitle'));
      setMeta('meta[property="og:description"]', 'content', t('meta.ogDescription'));
    } else {
      setMeta('meta[property="og:title"]', 'content', t(titleKey));
      setMeta('meta[property="og:description"]', 'content', t(descKey));
    }

    var localeMeta = (catalog.locales || []).find(function (item) { return item.id === currentLocale; });
    document.documentElement.setAttribute('lang', (localeMeta && localeMeta.htmlLang) || 'en');
  }

  function applyTranslations(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });
    scope.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (!key) return;
      el.innerHTML = t(key);
    });
    scope.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      var mapping = el.getAttribute('data-i18n-attr');
      if (!mapping) return;
      mapping.split(';').forEach(function (pair) {
        var parts = pair.split(':');
        if (parts.length !== 2) return;
        var attr = parts[0].trim();
        var key = parts[1].trim();
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
    applyMeta();
    updateThemeToggleLabels();
    document.dispatchEvent(new CustomEvent('tinynote:localechange', { detail: { locale: currentLocale } }));
  }

  function updateThemeToggleLabels() {
    var themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    var theme = document.documentElement.getAttribute('data-theme') || 'dark';
    var label = theme === 'light' ? t('theme.toDark') : t('theme.toLight');
    themeToggle.setAttribute('aria-label', label);
    themeToggle.setAttribute('title', label);
  }

  function setLocale(locale, options) {
    var matched = matchLocale(locale) || catalog.defaultLocale || 'zh-Hans';
    currentLocale = matched;
    try {
      localStorage.setItem(STORAGE_KEY, matched);
    } catch (_) {}

    if (!options || options.updateUrl !== false) {
      try {
        var url = new URL(window.location.href);
        url.pathname = localePath(matched);
        url.searchParams.delete('lang');
        url.searchParams.delete('locale');
        if (url.pathname !== window.location.pathname) {
          window.location.assign(url.toString());
          return;
        }
        window.history.replaceState({}, document.title, url.toString());
      } catch (_) {}
    }

    var select = document.getElementById('langSelect');
    if (select && select.value !== matched) select.value = matched;

    applyTranslations(document);
  }

  function buildLanguageSelect() {
    var select = document.getElementById('langSelect');
    if (!select) return;
    select.innerHTML = '';
    (catalog.locales || []).forEach(function (item) {
      var option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label;
      select.appendChild(option);
    });
    select.value = currentLocale;
    select.setAttribute('aria-label', t('lang.label'));
    select.addEventListener('change', function () {
      setLocale(select.value);
    });
  }

  function init() {
    currentLocale = detectLocale();
    var params = new URLSearchParams(window.location.search);
    if (matchLocale(params.get('lang') || params.get('locale'))) {
      try {
        var localizedUrl = new URL(window.location.href);
        localizedUrl.pathname = localePath(currentLocale);
        localizedUrl.searchParams.delete('lang');
        localizedUrl.searchParams.delete('locale');
        window.location.replace(localizedUrl.toString());
        return;
      } catch (_) {}
    }
    // A localized URL is an explicit visitor intent. Only normalize the root
    // route, where language was inferred from a saved preference, browser, or
    // time zone, to the matching locale path.
    if (isRootLandingPath(window.location.pathname) && currentLocale !== (catalog.defaultLocale || 'zh-Hans')) {
      try {
        var detectedUrl = new URL(window.location.href);
        detectedUrl.pathname = localePath(currentLocale);
        if (detectedUrl.pathname !== window.location.pathname) {
          window.location.replace(detectedUrl.toString());
          return;
        }
      } catch (_) {}
    }
    buildLanguageSelect();
    applyTranslations(document);
  }

  window.TinyNoteI18n = {
    t: t,
    getLocale: function () { return currentLocale; },
    setLocale: setLocale,
    apply: applyTranslations,
    detectLocale: detectLocale,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
