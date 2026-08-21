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
    label: 'default',
    description: 'default',
    defaultMode: 'light',
    highlight: {
      light: '/themes/default/highlight-light.css',
      dark: '/themes/default/highlight-dark.css',
    },
  },
  {
    id: 'qinglan',
    label: 'qinglan',
    description: 'qinglan',
    defaultMode: 'light',
    highlight: {
      light: '/themes/qinglan/highlight-light.css',
      dark: '/themes/qinglan/highlight-dark.css',
    },
  },
  {
    id: 'sunset',
    label: 'sunset',
    description: 'sunset',
    defaultMode: 'light',
    highlight: {
      light: '/themes/sunset/highlight-light.css',
      dark: '/themes/sunset/highlight-dark.css',
    },
  },
  {
    id: 'paper',
    label: 'paper',
    description: 'paper',
    defaultMode: 'light',
    highlight: {
      light: '/themes/paper/highlight-light.css',
      dark: '/themes/paper/highlight-dark.css',
    },
  },
  {
    id: 'matcha',
    label: 'matcha',
    description: 'matcha',
    defaultMode: 'light',
    highlight: {
      light: '/themes/matcha/highlight-light.css',
      dark: '/themes/matcha/highlight-dark.css',
    },
  },
];

export const DEFAULT_COLOR_THEME_ID: ColorThemeId = 'matcha';

export function getColorTheme(id: string): ColorTheme {
  return COLOR_THEMES.find((theme) => theme.id === id)
    ?? COLOR_THEMES.find((theme) => theme.id === DEFAULT_COLOR_THEME_ID)
    ?? COLOR_THEMES[0];
}

export function isColorThemeId(id: string): id is ColorThemeId {
  return COLOR_THEMES.some((theme) => theme.id === id);
}
