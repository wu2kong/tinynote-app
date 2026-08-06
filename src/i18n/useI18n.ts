import { useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { LOCALE_OPTIONS, translate, type AppLocale, type I18nParams } from '@/i18n';

export function useI18n() {
  const locale = useStore((s) => s.displayLanguage);
  const setDisplayLanguage = useStore((s) => s.setDisplayLanguage);

  const t = useCallback(
    (key: string, params?: I18nParams) => translate(locale, key, params),
    [locale],
  );

  return {
    locale,
    t,
    setLocale: setDisplayLanguage,
    locales: LOCALE_OPTIONS,
  };
}

export type { AppLocale };
