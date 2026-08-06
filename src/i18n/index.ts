import { enMessages } from './en';
import { zhHansMessages } from './zh-Hans';
import { zhHantMessages } from './zh-Hant';
import { koMessages } from './ko';
import { jaMessages } from './ja';
import { ruMessages } from './ru';
import { deMessages } from './de';
import { itMessages } from './it';
import { frMessages } from './fr';
import { DEFAULT_LOCALE } from './types';
import type { AppLocale, I18nParams, MessageTree } from './types';

export type { AppLocale, I18nParams, MessageTree } from './types';
export { LOCALE_OPTIONS, DEFAULT_LOCALE, isAppLocale } from './types';

const catalogs: Record<AppLocale, MessageTree> = {
  en: enMessages,
  'zh-Hans': zhHansMessages,
  'zh-Hant': zhHantMessages,
  ko: koMessages,
  ja: jaMessages,
  ru: ruMessages,
  de: deMessages,
  it: itMessages,
  fr: frMessages,
};

let currentLocale: AppLocale = DEFAULT_LOCALE;

function readMessage(messages: MessageTree, key: string): string | undefined {
  let cursor: string | MessageTree | undefined = messages;
  for (const part of key.split('.')) {
    if (!part || typeof cursor === 'string') return undefined;
    cursor = cursor[part];
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

function interpolate(template: string, params?: I18nParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ));
}

export function setI18nLocale(locale: AppLocale): void {
  currentLocale = locale;
}

export function getI18nLocale(): AppLocale {
  return currentLocale;
}

export function getMessages(locale: AppLocale): MessageTree {
  return catalogs[locale] ?? catalogs[DEFAULT_LOCALE];
}

export function translate(locale: AppLocale, key: string, params?: I18nParams): string {
  const message = readMessage(getMessages(locale), key)
    ?? readMessage(getMessages(DEFAULT_LOCALE), key)
    ?? key;
  return interpolate(message, params);
}

export function t(key: string, params?: I18nParams): string {
  return translate(currentLocale, key, params);
}

export { catalogs };
