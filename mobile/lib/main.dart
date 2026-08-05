import 'package:flutter/material.dart';

import 'screens/home_screen.dart';
import 'services/library_service.dart';

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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _library.bootstrap();
    _library.addListener(_onLibraryChanged);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _library.removeListener(_onLibraryChanged);
    _library.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _library.iCloudEnabled) {
      _library.refresh();
    }
  }

  void _onLibraryChanged() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TinyNote 轻记',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E)),
        scaffoldBackgroundColor: const Color(0xFFF5F6F7),
        useMaterial3: true,
      ),
      home: HomeScreen(library: _library),
    );
  }
}
