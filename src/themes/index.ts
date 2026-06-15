export type ColorThemeId = 'default' | 'qinglan' | 'sunset' | 'paper' | 'matcha';

export interface ColorTheme {
  id: ColorThemeId;
  label: string;
  description: string;
  defaultMode: 'light' | 'dark';
  highlight: {
    light: string;
    dark: string;
  };
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'default',
    label: '极光蓝',
    description: '当前默认的玻璃拟态文档主题。',
    defaultMode: 'light',
    highlight: {
      light: '/themes/default/highlight-light.css',
      dark: '/themes/default/highlight-dark.css',
    },
  },
  {
    id: 'qinglan',
    label: '青灰蓝',
    description: '沉静克制的青灰蓝主题，主色为 #1D4C50。',
    defaultMode: 'light',
    highlight: {
      light: '/themes/qinglan/highlight-light.css',
      dark: '/themes/qinglan/highlight-dark.css',
    },
  },
  {
    id: 'sunset',
    label: '樱花粉',
    description: '偏少女粉的杂志感主题，柔和又醒目。',
    defaultMode: 'light',
    highlight: {
      light: '/themes/sunset/highlight-light.css',
      dark: '/themes/sunset/highlight-dark.css',
    },
  },
  {
    id: 'paper',
    label: '纸墨灰',
    description: '偏纸质阅读感的暖色主题。',
    defaultMode: 'light',
    highlight: {
      light: '/themes/paper/highlight-light.css',
      dark: '/themes/paper/highlight-dark.css',
    },
  },
  {
    id: 'matcha',
    label: '抹茶绿',
    description: '清爽偏自然的抹茶系主题，适合长时间阅读。',
    defaultMode: 'light',
    highlight: {
      light: '/themes/matcha/highlight-light.css',
      dark: '/themes/matcha/highlight-dark.css',
    },
  },
];

export const DEFAULT_COLOR_THEME_ID: ColorThemeId = 'default';

export function getColorTheme(id: string): ColorTheme {
  return COLOR_THEMES.find((theme) => theme.id === id) ?? COLOR_THEMES[0];
}

export function isColorThemeId(id: string): id is ColorThemeId {
  return COLOR_THEMES.some((theme) => theme.id === id);
}
