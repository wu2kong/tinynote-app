export type AppLocale = 'en' | 'zh-Hans' | 'zh-Hant' | 'ko' | 'ja' | 'ru' | 'de' | 'it' | 'fr';

export type I18nParams = Record<string, string | number>;

export type MessageTree = {
  readonly [key: string]: string | MessageTree;
};

export const DEFAULT_LOCALE: AppLocale = 'en';

export const LOCALE_OPTIONS: readonly { value: AppLocale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh-Hans', label: '简体中文' },
  { value: 'zh-Hant', label: '繁體中文' },
  { value: 'ko', label: '한국어' },
  { value: 'ja', label: '日本語' },
  { value: 'ru', label: 'Русский' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'fr', label: 'Français' },
] as const;

const LANGUAGE_TO_LOCALE: Record<string, AppLocale> = {
  en: 'en',
  ko: 'ko',
  ja: 'ja',
  ru: 'ru',
  de: 'de',
  it: 'it',
  fr: 'fr',
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string'
    && LOCALE_OPTIONS.some((option) => option.value === value);
}

/** Map a BCP 47 / OS locale tag onto a supported app locale. */
export function matchAppLocale(tag: string): AppLocale | null {
  const normalized = tag.trim().replace(/_/g, '-');
  if (!normalized) return null;
  if (isAppLocale(normalized)) return normalized;

  const lower = normalized.toLowerCase();
  if (lower === 'zh-hans' || lower.startsWith('zh-hans-')) return 'zh-Hans';
  if (lower === 'zh-hant' || lower.startsWith('zh-hant-')) return 'zh-Hant';
  if (lower === 'zh' || lower.startsWith('zh-')) {
    if (/^zh-(tw|hk|mo)(-|$)/i.test(normalized)) return 'zh-Hant';
    return 'zh-Hans';
  }

  const language = lower.split('-')[0] ?? '';
  return LANGUAGE_TO_LOCALE[language] ?? null;
}

/** Detect the best supported locale from the runtime / OS language list. */
export function detectSystemLocale(): AppLocale {
  const candidates: string[] = [];
  if (typeof navigator !== 'undefined') {
    if (Array.isArray(navigator.languages)) {
      candidates.push(...navigator.languages);
    }
    if (navigator.language) {
      candidates.push(navigator.language);
    }
  }

  for (const tag of candidates) {
    const matched = matchAppLocale(tag);
    if (matched) return matched;
  }
  return DEFAULT_LOCALE;
}

/** Resolve a stored preference, or fall back to system detection. */
export function resolveAppLocale(stored: unknown): { locale: AppLocale; fromSystem: boolean } {
  if (isAppLocale(stored)) {
    return { locale: stored, fromSystem: false };
  }
  return { locale: detectSystemLocale(), fromSystem: true };
}
