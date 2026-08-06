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

export function isAppLocale(value: string): value is AppLocale {
  return LOCALE_OPTIONS.some((option) => option.value === value);
}
