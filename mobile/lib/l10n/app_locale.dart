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

  static AppLocale fromId(String? id) {
    if (id == null || id.trim().isEmpty) return defaultLocale;
    final normalized = id.trim();
    for (final locale in AppLocale.values) {
      if (locale.localeId == normalized) return locale;
    }
    return defaultLocale;
  }
}
