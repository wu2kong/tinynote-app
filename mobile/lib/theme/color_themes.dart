enum ColorThemeId {
  defaultTheme('default', 'aurora-blue', 'aurora-blue'),
  qinglan('qinglan', 'teal-blue', 'teal-blue'),
  sunset('sunset', 'sakura-pink', 'sakura-pink'),
  paper('paper', 'paper-gray', 'paper-gray'),
  matcha('matcha', 'matcha-green', 'matcha-green');

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
