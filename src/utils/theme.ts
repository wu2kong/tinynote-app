import { ColorThemeId, getColorTheme } from '@/themes';

const HIGHLIGHT_LINK_ID = 'theme-highlight-stylesheet';

function ensureHighlightLink(): HTMLLinkElement {
  let link = document.getElementById(HIGHLIGHT_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = HIGHLIGHT_LINK_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  return link;
}

export function applyTheme(colorThemeId: ColorThemeId, isDark: boolean): void {
  const theme = getColorTheme(colorThemeId);
  const mode = isDark ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme-id', theme.id);
  document.documentElement.setAttribute('data-theme', mode);

  const highlightLink = ensureHighlightLink();
  highlightLink.href = isDark ? theme.highlight.dark : theme.highlight.light;
}
