/**
 * TinyNote Landing Page i18n Locales Registry.
 *
 * Each locale file (zh-Hans.js, zh-Hant.js, en.js, ja.js, ko.js, de.js, fr.js, it.js, ru.js)
 * self-registers its dictionary to window.TINYNOTE_LANDING_I18N.messages[localeId].
 *
 * Recommended load order in HTML:
 * 1. js/i18n-meta.js (defines metadata & supported locales)
 * 2. js/locales/zh-Hans.js (or all locale scripts)
 * 3. js/locales/index.js (ensures namespace integrity)
 * 4. js/i18n.js (runtime language switcher & translator)
 */
window.TINYNOTE_LANDING_I18N = window.TINYNOTE_LANDING_I18N || {};
window.TINYNOTE_LANDING_I18N.messages = window.TINYNOTE_LANDING_I18N.messages || {};
