enum ColorThemeId {
  defaultTheme('default', '极光蓝', '玻璃拟态风格的蓝调文档主题。'),
  qinglan('qinglan', '青灰蓝', '沉静克制的青灰蓝主题，主色为 #1D4C50。'),
  sunset('sunset', '樱花粉', '偏少女粉的杂志感主题，柔和又醒目。'),
  paper('paper', '纸墨灰', '偏纸质阅读感的暖色主题（默认）。'),
  matcha('matcha', '抹茶绿', '清爽偏自然的抹茶系主题，适合长时间阅读。');

  const ColorThemeId(this.id, this.label, this.description);

  final String id;
  final String label;
  final String description;

  static const ColorThemeId fallback = ColorThemeId.paper;

  static ColorThemeId fromId(String? value) {
    if (value == null) return ColorThemeId.fallback;
    for (final theme in ColorThemeId.values) {
      if (theme.id == value) return theme;
    }
    return ColorThemeId.fallback;
  }
}
