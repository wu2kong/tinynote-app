import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
  final ThemeController _theme = ThemeController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _library.bootstrap();
    _library.addListener(_onChanged);
    _theme.addListener(_onChanged);
    _theme.load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _library.removeListener(_onChanged);
    _theme.removeListener(_onChanged);
    _library.dispose();
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
    return ThemeScope(
      controller: _theme,
      child: MaterialApp(
        title: 'TinyNote 轻记',
        debugShowCheckedModeBanner: false,
        theme: _theme.themeData,
        builder: (context, child) {
          final overlay = _theme.isDark
              ? SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent)
              : SystemUiOverlayStyle.dark.copyWith(statusBarColor: Colors.transparent);
          return AnnotatedRegion<SystemUiOverlayStyle>(
            value: overlay,
            child: child ?? const SizedBox.shrink(),
          );
        },
        home: HomeScreen(library: _library),
      ),
    );
  }
}
