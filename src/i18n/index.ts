import { createContext, useContext, useMemo } from 'react';
import { en, type Dictionary } from './en';
import { deCHDraft } from './de-CH.draft';
import type { LocaleCode } from '../data/local/models';

type Path<T, P extends string = ''> = {
  [K in keyof T & (string | number)]: T[K] extends string ? `${P}${K}` : Path<T[K], `${P}${K}.`>;
}[keyof T & (string | number)];

export type TranslationKey = Path<Dictionary>;
export type TranslateParams = Record<string, string | number>;

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function translate(locale: LocaleCode, key: TranslationKey, params?: TranslateParams): string {
  const template = (locale === 'de-CH' ? lookup(deCHDraft, key) : undefined) ?? lookup(en, key) ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in params ? String(params[name]) : `{${name}}`));
}

/** Loose key for dynamic lookups such as `equipment.${id}`. Falls back to the key itself. */
export function translateDynamic(locale: LocaleCode, key: string, params?: TranslateParams): string {
  return translate(locale, key as TranslationKey, params);
}

export const LocaleContext = createContext<LocaleCode>('en');

export function useT() {
  const locale = useContext(LocaleContext);
  return useMemo(
    () =>
      Object.assign((key: TranslationKey, params?: TranslateParams) => translate(locale, key, params), {
        dyn: (key: string, params?: TranslateParams) => translateDynamic(locale, key, params),
        locale,
      }),
    [locale],
  );
}
