import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_locale.dart';
import 'app_strings.dart';
import 'strings_de.dart';
import 'strings_en.dart';
import 'strings_fr.dart';
import 'strings_it.dart';
import 'strings_ja.dart';
import 'strings_ko.dart';
import 'strings_ru.dart';
import 'strings_zh_hans.dart';
import 'strings_zh_hant.dart';

export 'app_locale.dart';
export 'app_strings.dart';

const localePreferenceKey = 'tinynote.locale';

LocaleController? appLocaleController;

AppStrings get appStrings => appLocaleController?.strings ?? stringsEn;

AppStrings of(AppLocale locale) {
  return switch (locale) {
    AppLocale.en => stringsEn,
    AppLocale.zhHans => stringsZhHans,
    AppLocale.zhHant => stringsZhHant,
    AppLocale.ko => stringsKo,
    AppLocale.ja => stringsJa,
    AppLocale.ru => stringsRu,
    AppLocale.de => stringsDe,
    AppLocale.it => stringsIt,
    AppLocale.fr => stringsFr,
  };
}

class LocaleController extends ChangeNotifier {
  LocaleController({AppLocale initialLocale = AppLocale.defaultLocale})
    : _locale = initialLocale;

  AppLocale _locale;

  AppLocale get locale => _locale;
  Locale get flutterLocale => _locale.locale;
  AppStrings get strings => of(_locale);

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = AppLocale.tryParseId(prefs.getString(localePreferenceKey));
    if (stored != null) {
      if (stored == _locale) return;
      _locale = stored;
      notifyListeners();
      return;
    }

    // First launch: match OS language, then persist so later launches stay stable.
    final detected = AppLocale.detectSystem();
    _locale = detected;
    notifyListeners();
    await prefs.setString(localePreferenceKey, detected.localeId);
  }

  Future<void> setLocale(AppLocale locale) async {
    if (locale == _locale) return;
    _locale = locale;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(localePreferenceKey, locale.localeId);
  }
}

class LocaleScope extends InheritedNotifier<LocaleController> {
  const LocaleScope({
    super.key,
    required LocaleController controller,
    required super.child,
  }) : super(notifier: controller);

  static LocaleController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<LocaleScope>();
    assert(scope != null, 'LocaleScope not found in context');
    return scope!.notifier!;
  }

  static LocaleController? maybeOf(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<LocaleScope>();
    return scope?.notifier;
  }
}

extension AppL10nBuildContext on BuildContext {
  LocaleController get l10n => LocaleScope.of(this);
  AppStrings get s => l10n.strings;
}
