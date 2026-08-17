(function () {
  var REPO = 'wu2kong/tinynote-app';
  var API_URL = 'https://api.github.com/repos/' + REPO + '/releases/latest';
  var RELEASES_URL = 'https://github.com/' + REPO + '/releases';

  /** Expected download slots. Match GitHub asset names; unmatched = coming soon. */
  var SLOTS = [
    {
      id: 'macos-dmg',
      platform: 'macos',
      formats: ['dmg'],
      arch: 'universal',
      recommendOn: ['macos'],
      match: function (name) {
        return /universal\.dmg$/i.test(name) || (/\.dmg$/i.test(name) && !/aarch64|x64|x86_64/i.test(name));
      },
    },
    {
      id: 'windows-exe',
      platform: 'windows',
      formats: ['exe'],
      arch: 'x64',
      recommendOn: ['windows'],
      match: function (name) {
        return /x64-setup\.exe$/i.test(name) || /-setup\.exe$/i.test(name);
      },
    },
    {
      id: 'windows-msi',
      platform: 'windows',
      formats: ['msi'],
      arch: 'x64',
      recommendOn: [],
      match: function (name) {
        return /\.msi$/i.test(name);
      },
    },
    {
      id: 'linux-appimage',
      platform: 'linux',
      formats: ['appimage'],
      arch: 'x64',
      recommendOn: ['linux'],
      match: function (name) {
        return /\.AppImage$/i.test(name);
      },
    },
    {
      id: 'linux-deb',
      platform: 'linux',
      formats: ['deb'],
      arch: 'x64',
      recommendOn: [],
      match: function (name) {
        return /\.deb$/i.test(name);
      },
    },
    {
      id: 'linux-rpm',
      platform: 'linux',
      formats: ['rpm'],
      arch: 'x64',
      recommendOn: [],
      match: function (name) {
        return /\.rpm$/i.test(name);
      },
    },
    {
      id: 'ios-appstore',
      platform: 'ios',
      formats: ['appstore'],
      arch: 'arm64',
      recommendOn: ['ios'],
      match: function () {
        return false;
      },
    },
    {
      id: 'android-play',
      platform: 'android',
      formats: ['play'],
      arch: 'arm64',
      recommendOn: ['android'],
      match: function (name) {
        return /\.apk$/i.test(name) || /android/i.test(name);
      },
    },
  ];

  var PLATFORMS = [
    { id: 'macos', icon: 'apple' },
    { id: 'windows', icon: 'windows' },
    { id: 'linux', icon: 'linux' },
    { id: 'ios', icon: 'ios' },
    { id: 'android', icon: 'android' },
  ];

  var state = {
    tagName: '',
    publishedAt: '',
    htmlUrl: RELEASES_URL + '/latest',
    assets: [],
    error: false,
    loading: true,
  };

  function t(key, params) {
    if (window.TinyNoteI18n && typeof window.TinyNoteI18n.t === 'function') {
      return window.TinyNoteI18n.t(key, params);
    }
    return key;
  }

  function detectOs() {
    var ua = navigator.userAgent || '';
    var platform = navigator.platform || '';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(platform) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    if (/Mac/i.test(ua) || /Mac/i.test(platform)) return 'macos';
    if (/Win/i.test(ua) || /Win/i.test(platform)) return 'windows';
    if (/Linux/i.test(ua) || /Linux/i.test(platform)) return 'linux';
    return 'unknown';
  }

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '';
    var n = Number(bytes);
    if (!isFinite(n) || n < 0) return '';
    if (n < 1024) return n + ' B';
    var units = ['KB', 'MB', 'GB'];
    var i = -1;
    do {
      n /= 1024;
      i++;
    } while (n >= 1024 && i < units.length - 1);
    return n.toFixed(n >= 10 || i === 0 ? 0 : 1) + ' ' + units[i];
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      var locale = (window.TinyNoteI18n && TinyNoteI18n.getLocale && TinyNoteI18n.getLocale()) || 'en';
      var map = {
        'zh-Hans': 'zh-CN',
        'zh-Hant': 'zh-TW',
        en: 'en',
        ja: 'ja',
        ko: 'ko',
        de: 'de',
        fr: 'fr',
        it: 'it',
        ru: 'ru',
      };
      return new Date(iso).toLocaleDateString(map[locale] || 'en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (_) {
      return String(iso).slice(0, 10);
    }
  }

  function isIgnorableAsset(name) {
    return /\.(sig|json)$/i.test(name) || /\.app\.tar\.gz$/i.test(name) || /_updater/i.test(name);
  }

  function resolveSlots(assets) {
    var used = {};
    return SLOTS.map(function (slot) {
      var found = null;
      for (var i = 0; i < assets.length; i++) {
        var asset = assets[i];
        if (!asset || !asset.name || used[asset.name]) continue;
        if (isIgnorableAsset(asset.name)) continue;
        if (slot.match(asset.name)) {
          found = asset;
          used[asset.name] = true;
          break;
        }
      }
      return {
        id: slot.id,
        platform: slot.platform,
        formats: slot.formats,
        arch: slot.arch,
        recommendOn: slot.recommendOn,
        available: !!found,
        name: found ? found.name : '',
        url: found ? found.browser_download_url : '',
        size: found ? found.size : 0,
      };
    });
  }

  function platformIcon(kind) {
    if (kind === 'apple' || kind === 'ios') {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.365 1.43c0 1.14-.418 2.2-1.18 3.01-.8.86-2.13 1.52-3.27 1.43-.15-1.1.43-2.26 1.18-3.05.8-.86 2.2-1.5 3.27-1.39zM20.5 17.3c-.55 1.27-.82 1.83-1.53 2.95-1 1.55-2.4 3.48-4.14 3.5-1.54.02-1.94-.99-4.04-.98-2.1.01-2.54 1-4.08.98-1.74-.02-3.07-1.76-4.07-3.3C.74 17.2-.5 12.9 1.4 9.86c1.17-1.9 3.02-3.1 4.76-3.1 1.77 0 2.88.99 4.35.99 1.42 0 2.29-1 4.43-.99 1.56.01 3.2.9 4.36 2.45-3.83 2.1-3.21 7.56.2 8.09z"/></svg>';
    }
    if (kind === 'windows') {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5.5l8-1.1v7.1H3V5.5zm9-1.25L21 3v8.5h-9V4.25zM3 12.5h8v7.1l-8-1.1V12.5zm9 0H21V21l-9-1.25V12.5z"/></svg>';
    }
    if (kind === 'android') {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.6 9.48l1.84-3.18a.5.5 0 0 0-.87-.5l-1.9 3.28A8.1 8.1 0 0 0 12 8c-1.67 0-3.2.5-4.47 1.35L5.63 5.8a.5.5 0 1 0-.87.5L6.6 9.48C4.45 10.9 3 13.27 3 16v.5h18V16c0-2.73-1.45-5.1-3.4-6.52zM7.5 14.25a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm9 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM5 17.5h14v2a1.5 1.5 0 0 1-1.5 1.5h-1v2.25a.75.75 0 0 1-1.5 0V21h-6v2.25a.75.75 0 0 1-1.5 0V21h-1A1.5 1.5 0 0 1 5 19.5v-2z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.5 2c-.4 0-1.2.4-1.8 1.1-.6.8-.9 1.7-.8 2.5.5.05 1.2-.35 1.8-1 .6-.7.9-1.6.8-2.6zM17.7 8.3c-.9 0-1.8.5-2.7.5-.9 0-2-.5-3.3-.5-1.7.05-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.3 1.9 2.6 3.3 2.6 1.3-.05 1.8-.85 3.4-.85 1.6 0 2 .85 3.4.85 1.4 0 2.4-1.25 3.3-2.55 1-1.5 1.4-3 1.45-3.05-.05 0-2.7-1.05-2.7-4.15 0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.8-2.05-.9-.05-1.7.4-2.2.4z"/></svg>';
  }

  function formatLabel(formatId) {
    return t('download.format.' + formatId);
  }

  function archLabel(archId) {
    return t('download.arch.' + archId);
  }

  function renderRecommended(slots) {
    var el = document.getElementById('downloadRecommended');
    if (!el) return;

    var os = detectOs();
    var pick = null;
    var soonPick = null;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].recommendOn.indexOf(os) === -1) continue;
      if (slots[i].available) {
        pick = slots[i];
        break;
      }
      if (!soonPick) soonPick = slots[i];
    }
    if (!pick) {
      for (var j = 0; j < slots.length; j++) {
        if (slots[j].available) {
          pick = slots[j];
          break;
        }
      }
    }

    if (soonPick && !soonPick.available && (os === 'ios' || os === 'android')) {
      var mobileName = t('download.' + soonPick.platform);
      el.innerHTML =
        '<div class="download-recommended-inner">' +
        '<p class="download-recommended-label">' +
        t('download.recommendedFor', { platform: mobileName }) +
        '</p>' +
        '<span class="download-soon-badge">' +
        t('download.comingSoon') +
        '</span>' +
        '<p class="download-recommended-meta">' +
        t('download.comingSoonHint') +
        '</p></div>';
      return;
    }

    if (!pick) {
      el.innerHTML =
        '<div class="download-recommended-inner">' +
        '<p class="download-recommended-label" data-i18n="download.recommended">' +
        t('download.recommended') +
        '</p>' +
        '<a class="btn btn-ghost btn-lg" href="' +
        state.htmlUrl +
        '" target="_blank" rel="noopener noreferrer" data-i18n="download.viewReleases">' +
        t('download.viewReleases') +
        '</a></div>';
      return;
    }

    var platformName = t('download.' + pick.platform);
    el.innerHTML =
      '<div class="download-recommended-inner">' +
      '<p class="download-recommended-label">' +
      t('download.recommendedFor', { platform: platformName }) +
      '</p>' +
      '<a class="btn btn-primary btn-lg" href="' +
      pick.url +
      '" rel="noopener noreferrer">' +
      '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
      '<span>' +
      t('download.recommendedCta', { platform: platformName }) +
      '</span></a>' +
      '<p class="download-recommended-meta">' +
      escapeHtml(pick.name) +
      (pick.size ? ' · ' + formatBytes(pick.size) : '') +
      '</p></div>';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderPlatforms(slots) {
    var root = document.getElementById('downloadPlatforms');
    if (!root) return;

    var html = '';
    PLATFORMS.forEach(function (platform) {
      var platformSlots = slots.filter(function (s) {
        return s.platform === platform.id;
      });
      var anyAvailable = platformSlots.some(function (s) {
        return s.available;
      });

      html +=
        '<section class="download-platform' +
        (anyAvailable ? '' : ' is-soon') +
        '" data-platform="' +
        platform.id +
        '">' +
        '<header class="download-platform-header">' +
        '<span class="download-platform-icon">' +
        platformIcon(platform.icon) +
        '</span>' +
        '<div>' +
        '<h2 class="download-platform-title">' +
        t('download.' + platform.id) +
        '</h2>' +
        '<p class="download-platform-desc">' +
        t('download.' + platform.id + 'Desc') +
        '</p></div></header>' +
        '<ul class="download-asset-list">';

      platformSlots.forEach(function (slot) {
        var formatText = slot.formats.map(formatLabel).join(' / ');
        var archText = archLabel(slot.arch);
        if (slot.available) {
          html +=
            '<li class="download-asset">' +
            '<div class="download-asset-info">' +
            '<div class="download-asset-name">' +
            formatText +
            ' · ' +
            archText +
            '</div>' +
            '<div class="download-asset-file">' +
            escapeHtml(slot.name) +
            (slot.size ? ' · ' + formatBytes(slot.size) : '') +
            '</div></div>' +
            '<a class="btn btn-primary" href="' +
            slot.url +
            '" rel="noopener noreferrer">' +
            t('download.cta') +
            '</a></li>';
        } else {
          html +=
            '<li class="download-asset is-soon">' +
            '<div class="download-asset-info">' +
            '<div class="download-asset-name">' +
            formatText +
            ' · ' +
            archText +
            '</div>' +
            '<div class="download-asset-file">' +
            t('download.comingSoonHint') +
            '</div></div>' +
            '<span class="download-soon-badge">' +
            t('download.comingSoon') +
            '</span></li>';
        }
      });

      html += '</ul></section>';
    });

    root.innerHTML = html;
  }

  function renderMeta() {
    var versionEl = document.getElementById('downloadVersion');
    var dateEl = document.getElementById('downloadDate');
    var linkEl = document.getElementById('downloadReleasesLink');
    var statusEl = document.getElementById('downloadStatus');

    if (versionEl) {
      versionEl.textContent = state.tagName
        ? t('download.version', { version: state.tagName })
        : t('download.loading');
    }
    if (dateEl) {
      dateEl.textContent = state.publishedAt
        ? t('download.released', { date: formatDate(state.publishedAt) })
        : '';
    }
    if (linkEl) {
      linkEl.href = state.htmlUrl || RELEASES_URL;
    }
    if (statusEl) {
      if (state.loading) {
        statusEl.hidden = false;
        statusEl.textContent = t('download.loading');
      } else if (state.error) {
        statusEl.hidden = false;
        statusEl.textContent = t('download.error');
      } else {
        statusEl.hidden = true;
        statusEl.textContent = '';
      }
    }

    document.title = t('download.meta.title');
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t('download.meta.description'));
  }

  function renderAll() {
    var slots = resolveSlots(state.assets);
    renderMeta();
    if (!state.loading) {
      renderRecommended(slots);
      renderPlatforms(slots);
    }
  }

  function applyFallbackAssets() {
    // Known latest assets if GitHub API is unreachable (CORS/rate-limit/network).
    state.tagName = 'v1.1.0';
    state.publishedAt = '2026-07-21T04:56:39Z';
    state.htmlUrl = 'https://github.com/' + REPO + '/releases/tag/v1.1.0';
    state.assets = [
      {
        name: 'TinyNote_1.1.0_universal.dmg',
        browser_download_url:
          'https://github.com/' + REPO + '/releases/download/v1.1.0/TinyNote_1.1.0_universal.dmg',
        size: 16239865,
      },
      {
        name: 'TinyNote_1.1.0_x64-setup.exe',
        browser_download_url:
          'https://github.com/' + REPO + '/releases/download/v1.1.0/TinyNote_1.1.0_x64-setup.exe',
        size: 5089660,
      },
      {
        name: 'TinyNote_1.1.0_x64_en-US.msi',
        browser_download_url:
          'https://github.com/' + REPO + '/releases/download/v1.1.0/TinyNote_1.1.0_x64_en-US.msi',
        size: 6967296,
      },
    ];
  }

  function loadRelease() {
    state.loading = true;
    state.error = false;
    renderMeta();

    fetch(API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        state.tagName = data.tag_name || data.name || '';
        state.publishedAt = data.published_at || '';
        state.htmlUrl = data.html_url || RELEASES_URL + '/latest';
        state.assets = Array.isArray(data.assets) ? data.assets : [];
        state.loading = false;
        state.error = false;
        renderAll();
      })
      .catch(function () {
        applyFallbackAssets();
        state.loading = false;
        state.error = true;
        renderAll();
      });
  }

  function init() {
    loadRelease();
    document.addEventListener('tinynote:localechange', function () {
      renderAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
