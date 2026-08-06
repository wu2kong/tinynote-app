import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_palette.dart';
import 'color_themes.dart';

class ThemeController extends ChangeNotifier {
  static const _darkKey = 'tinynote.theme.isDark';
  static const _colorKey = 'tinynote.theme.colorId';

  bool _isDark = false;
  ColorThemeId _colorThemeId = ColorThemeId.fallback;
  bool _ready = false;

  bool get isDark => _isDark;
  ColorThemeId get colorThemeId => _colorThemeId;
  bool get ready => _ready;
  AppPalette get palette => AppPalette.resolve(_colorThemeId, _isDark);
  ThemeData get themeData => palette.toThemeData(isDark: _isDark);

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _isDark = prefs.getBool(_darkKey) ?? false;
    _colorThemeId = ColorThemeId.fromId(prefs.getString(_colorKey));
    _ready = true;
    notifyListeners();
  }

  Future<void> toggleDark() => setDark(!_isDark);

  Future<void> setDark(bool value) async {
    if (_isDark == value) return;
    _isDark = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_darkKey, value);
  }

  Future<void> setColorTheme(ColorThemeId id) async {
    if (_colorThemeId == id) return;
    _colorThemeId = id;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_colorKey, id.id);
  }
}
