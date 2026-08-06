import 'dart:ui';

enum AppLocale {
  en('en', 'English', Locale('en')),
  zhHans(
    'zh-Hans',
    '简体中文',
    Locale.fromSubtags(languageCode: 'zh', scriptCode: 'Hans'),
  ),
  zhHant(
    'zh-Hant',
    '繁體中文',
    Locale.fromSubtags(languageCode: 'zh', scriptCode: 'Hant'),
  ),
  ko('ko', '한국어', Locale('ko')),
  ja('ja', '日本語', Locale('ja')),
  ru('ru', 'Русский', Locale('ru')),
  de('de', 'Deutsch', Locale('de')),
  it('it', 'Italiano', Locale('it')),
  fr('fr', 'Français', Locale('fr'));

  const AppLocale(this.localeId, this.nativeLabel, this.locale);

  static const AppLocale defaultLocale = AppLocale.en;

  final String localeId;
  final String nativeLabel;
  final Locale locale;

  static AppLocale? tryParseId(String? id) {
    if (id == null || id.trim().isEmpty) return null;
    final normalized = id.trim();
    for (final locale in AppLocale.values) {
      if (locale.localeId == normalized) return locale;
    }
    return null;
  }

  static AppLocale fromId(String? id) => tryParseId(id) ?? defaultLocale;

  /// Map a platform [Locale] onto a supported app locale.
  static AppLocale? matchSystemLocale(Locale locale) {
    final language = locale.languageCode.toLowerCase();
    final script = locale.scriptCode?.toLowerCase();
    final country = locale.countryCode?.toLowerCase();

    if (language == 'zh') {
      if (script == 'hant') return AppLocale.zhHant;
      if (script == 'hans') return AppLocale.zhHans;
      if (country == 'tw' || country == 'hk' || country == 'mo') {
        return AppLocale.zhHant;
      }
      return AppLocale.zhHans;
    }

    return switch (language) {
      'en' => AppLocale.en,
      'ko' => AppLocale.ko,
      'ja' => AppLocale.ja,
      'ru' => AppLocale.ru,
      'de' => AppLocale.de,
      'it' => AppLocale.it,
      'fr' => AppLocale.fr,
      _ => null,
    };
  }

  /// Pick the best supported locale from the OS language preference list.
  static AppLocale detectSystem([List<Locale>? preferredLocales]) {
    final locales =
        preferredLocales ?? PlatformDispatcher.instance.locales;
    for (final locale in locales) {
      final matched = matchSystemLocale(locale);
      if (matched != null) return matched;
    }
    return defaultLocale;
  }
}
