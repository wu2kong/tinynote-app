import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'l10n/l10n.dart';
import 'screens/home_screen.dart';
import 'services/library_service.dart';
import 'theme/app_colors.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TinyNoteApp());
}

class TinyNoteApp extends StatefulWidget {
  const TinyNoteApp({super.key});

  @override
  State<TinyNoteApp> createState() => _TinyNoteAppState();
}

class _TinyNoteAppState extends State<TinyNoteApp> with WidgetsBindingObserver {
  final LibraryService _library = LibraryService();
  final LocaleController _locale = LocaleController();
  final ThemeController _theme = ThemeController();

  @override
  void initState() {
    super.initState();
    appLocaleController = _locale;
    WidgetsBinding.instance.addObserver(this);
    _library.bootstrap();
    _library.addListener(_onChanged);
    _locale.addListener(_onChanged);
    _theme.addListener(_onChanged);
    _locale.load();
    _theme.load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _library.removeListener(_onChanged);
    _locale.removeListener(_onChanged);
    _theme.removeListener(_onChanged);
    _library.dispose();
    _locale.dispose();
    if (appLocaleController == _locale) {
      appLocaleController = null;
    }
    _theme.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _library.iCloudEnabled) {
      _library.refresh();
    }
  }

  void _onChanged() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return LocaleScope(
      controller: _locale,
      child: ThemeScope(
        controller: _theme,
        child: MaterialApp(
          title: _locale.strings.appTitle,
          locale: _locale.flutterLocale,
          supportedLocales: AppLocale.values.map((e) => e.locale).toList(),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          debugShowCheckedModeBanner: false,
          theme: _theme.themeData,
          builder: (context, child) {
            final overlay =
                _theme.isDark
                    ? SystemUiOverlayStyle.light.copyWith(
                      statusBarColor: Colors.transparent,
                    )
                    : SystemUiOverlayStyle.dark.copyWith(
                      statusBarColor: Colors.transparent,
                    );
            return AnnotatedRegion<SystemUiOverlayStyle>(
              value: overlay,
              child: child ?? const SizedBox.shrink(),
            );
          },
          home: HomeScreen(library: _library),
        ),
      ),
    );
  }
}
