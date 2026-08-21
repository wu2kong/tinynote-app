import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'color_themes.dart';

@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({
    required this.accent,
    required this.accentSoft,
    required this.background,
    required this.surface,
    required this.title,
    required this.body,
    required this.muted,
    required this.border,
    required this.danger,
    required this.dangerSoft,
    required this.codeBg,
    required this.codeFg,
    required this.hover,
  });

  final Color accent;
  final Color accentSoft;
  final Color background;
  final Color surface;
  final Color title;
  final Color body;
  final Color muted;
  final Color border;
  final Color danger;
  final Color dangerSoft;
  final Color codeBg;
  final Color codeFg;
  final Color hover;

  static const fallback = _matchaLight;

  static AppPalette resolve(ColorThemeId id, bool isDark) {
    return switch (id) {
      ColorThemeId.defaultTheme => isDark ? _defaultDark : _defaultLight,
      ColorThemeId.qinglan => isDark ? _qinglanDark : _qinglanLight,
      ColorThemeId.sunset => isDark ? _sunsetDark : _sunsetLight,
      ColorThemeId.paper => isDark ? _paperDark : _paperLight,
      ColorThemeId.matcha => isDark ? _matchaDark : _matchaLight,
    };
  }

  ThemeData toThemeData({required bool isDark}) {
    final brightness = isDark ? Brightness.dark : Brightness.light;
    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: background,
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: accent,
        onPrimary: isDark ? title : Colors.white,
        secondary: accent,
        onSecondary: isDark ? title : Colors.white,
        error: danger,
        onError: Colors.white,
        surface: surface,
        onSurface: title,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: surface,
        foregroundColor: title,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        systemOverlayStyle:
            isDark
                ? SystemUiOverlayStyle.light.copyWith(
                  statusBarColor: Colors.transparent,
                )
                : SystemUiOverlayStyle.dark.copyWith(
                  statusBarColor: Colors.transparent,
                ),
      ),
      dividerColor: border,
      cardColor: surface,
      dialogTheme: DialogThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: isDark ? hover : title,
        contentTextStyle: TextStyle(color: isDark ? title : Colors.white),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return accent;
          return null;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return accentSoft;
          return null;
        }),
      ),
      extensions: [this],
    );
  }

  @override
  AppPalette copyWith({
    Color? accent,
    Color? accentSoft,
    Color? background,
    Color? surface,
    Color? title,
    Color? body,
    Color? muted,
    Color? border,
    Color? danger,
    Color? dangerSoft,
    Color? codeBg,
    Color? codeFg,
    Color? hover,
  }) {
    return AppPalette(
      accent: accent ?? this.accent,
      accentSoft: accentSoft ?? this.accentSoft,
      background: background ?? this.background,
      surface: surface ?? this.surface,
      title: title ?? this.title,
      body: body ?? this.body,
      muted: muted ?? this.muted,
      border: border ?? this.border,
      danger: danger ?? this.danger,
      dangerSoft: dangerSoft ?? this.dangerSoft,
      codeBg: codeBg ?? this.codeBg,
      codeFg: codeFg ?? this.codeFg,
      hover: hover ?? this.hover,
    );
  }

  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    return AppPalette(
      accent: Color.lerp(accent, other.accent, t)!,
      accentSoft: Color.lerp(accentSoft, other.accentSoft, t)!,
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      title: Color.lerp(title, other.title, t)!,
      body: Color.lerp(body, other.body, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      border: Color.lerp(border, other.border, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      dangerSoft: Color.lerp(dangerSoft, other.dangerSoft, t)!,
      codeBg: Color.lerp(codeBg, other.codeBg, t)!,
      codeFg: Color.lerp(codeFg, other.codeFg, t)!,
      hover: Color.lerp(hover, other.hover, t)!,
    );
  }
}

const _defaultLight = AppPalette(
  accent: Color(0xFF3A6FF7),
  accentSoft: Color(0x1F3A6FF7),
  background: Color(0xFFF6F7FB),
  surface: Color(0xFFFFFFFF),
  title: Color(0xFF1F2937),
  body: Color(0xFF6B7280),
  muted: Color(0xFF94A3B8),
  border: Color(0x38A0AEC0),
  danger: Color(0xFFEF4444),
  dangerSoft: Color(0xFFFEE2E2),
  codeBg: Color(0xFFFBFDFF),
  codeFg: Color(0xFF233044),
  hover: Color(0xFFE8EEF7),
);

const _defaultDark = AppPalette(
  accent: Color(0xFF7AA2FF),
  accentSoft: Color(0x247AA2FF),
  background: Color(0xFF0B1120),
  surface: Color(0xFF0F172A),
  title: Color(0xFFE5EDF9),
  body: Color(0xFFA3B2C6),
  muted: Color(0xFF6F8099),
  border: Color(0x29A0AEC0),
  danger: Color(0xFFF87171),
  dangerSoft: Color(0x417F1D1D),
  codeBg: Color(0xFF142033),
  codeFg: Color(0xFFDBEAFE),
  hover: Color(0xFF182033),
);

const _qinglanLight = AppPalette(
  accent: Color(0xFF1D4C50),
  accentSoft: Color(0x1F1D4C50),
  background: Color(0xFFEDF4F4),
  surface: Color(0xFFF9FCFC),
  title: Color(0xFF203437),
  body: Color(0xFF607B7E),
  muted: Color(0xFF8CA2A5),
  border: Color(0x2E1D4C50),
  danger: Color(0xFFEF4444),
  dangerSoft: Color(0xFFFEE2E2),
  codeBg: Color(0xFFF2F8F8),
  codeFg: Color(0xFF1F3638),
  hover: Color(0xFFD1DEDE),
);

const _qinglanDark = AppPalette(
  accent: Color(0xFF5F9AA0),
  accentSoft: Color(0x245F9AA0),
  background: Color(0xFF0D1718),
  surface: Color(0xFF132022),
  title: Color(0xFFE3EFEF),
  body: Color(0xFFA8BEC0),
  muted: Color(0xFF6F8B8D),
  border: Color(0x2482ABAF),
  danger: Color(0xFFF87171),
  dangerSoft: Color(0x417F1D1D),
  codeBg: Color(0xFF0F1B1D),
  codeFg: Color(0xFFE5F3F3),
  hover: Color(0xFF1E3133),
);

const _sunsetLight = AppPalette(
  accent: Color(0xFFE05B96),
  accentSoft: Color(0x24E05B96),
  background: Color(0xFFFFF0F6),
  surface: Color(0xFFFFF9FC),
  title: Color(0xFF40232F),
  body: Color(0xFF956779),
  muted: Color(0xFFC095A6),
  border: Color(0x2EA4587C),
  danger: Color(0xFFEF4444),
  dangerSoft: Color(0xFFFEE2E2),
  codeBg: Color(0xFFFFF4F8),
  codeFg: Color(0xFF4A2935),
  hover: Color(0xFFFFD2E4),
);

const _sunsetDark = AppPalette(
  accent: Color(0xFFFF8FC2),
  accentSoft: Color(0x24FF8FC2),
  background: Color(0xFF1D1118),
  surface: Color(0xFF261520),
  title: Color(0xFFF9E7F0),
  body: Color(0xFFD7AAC0),
  muted: Color(0xFF9A6F84),
  border: Color(0x24F2C4DC),
  danger: Color(0xFFF87171),
  dangerSoft: Color(0x417F1D1D),
  codeBg: Color(0xFF271520),
  codeFg: Color(0xFFFFF0F7),
  hover: Color(0xFF3D2133),
);

const _paperLight = AppPalette(
  accent: Color(0xFF8A5A2B),
  accentSoft: Color(0x1F8A5A2B),
  background: Color(0xFFF3ECE1),
  surface: Color(0xFFFFFAF2),
  title: Color(0xFF3F2F21),
  body: Color(0xFF7D6752),
  muted: Color(0xFFA48B73),
  border: Color(0x2E6C5438),
  danger: Color(0xFFEF4444),
  dangerSoft: Color(0xFFFEE2E2),
  codeBg: Color(0xFFFFFAF4),
  codeFg: Color(0xFF4A3422),
  hover: Color(0xFFE6D6BB),
);

const _paperDark = AppPalette(
  accent: Color(0xFFD1A16C),
  accentSoft: Color(0x24D1A16C),
  background: Color(0xFF17120D),
  surface: Color(0xFF211912),
  title: Color(0xFFF1E4D4),
  body: Color(0xFFC2AB93),
  muted: Color(0xFF8F7762),
  border: Color(0x24CDAD8D),
  danger: Color(0xFFF87171),
  dangerSoft: Color(0x417F1D1D),
  codeBg: Color(0xFF2A1F16),
  codeFg: Color(0xFFF8EFE3),
  hover: Color(0xFF35291E),
);

const _matchaLight = AppPalette(
  accent: Color(0xFF3E7A57),
  accentSoft: Color(0x1F3E7A57),
  background: Color(0xFFEDF3EB),
  surface: Color(0xFFF9FDF6),
  title: Color(0xFF223127),
  body: Color(0xFF5F7765),
  muted: Color(0xFF8AA08F),
  border: Color(0x2E486952),
  danger: Color(0xFFEF4444),
  dangerSoft: Color(0xFFFEE2E2),
  codeBg: Color(0xFFF4FAF1),
  codeFg: Color(0xFF223127),
  hover: Color(0xFFD6E4D0),
);

const _matchaDark = AppPalette(
  accent: Color(0xFF86C69D),
  accentSoft: Color(0x2486C69D),
  background: Color(0xFF101914),
  surface: Color(0xFF15221B),
  title: Color(0xFFE6F0E8),
  body: Color(0xFFA6C0AD),
  muted: Color(0xFF718A78),
  border: Color(0x24ABCAB5),
  danger: Color(0xFFF87171),
  dangerSoft: Color(0x417F1D1D),
  codeBg: Color(0xFF112019),
  codeFg: Color(0xFFE8F5EB),
  hover: Color(0xFF22342A),
);
