import type { CoachReason } from '../domain/coach';
import type { LocalDate } from '../domain/types';
import type { LocaleCode } from '../data/local/models';
import { DEV_CATALOGUE as catalogue } from '../content/exercises.dev';
import { translate, translateDynamic, type TranslationKey } from './index';

export function formatDate(date: LocalDate, locale: LocaleCode): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'de-CH' ? 'de-CH' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function exerciseName(id: string): string {
  return catalogue[id]?.name.en ?? id;
}

export function reasonText(locale: LocaleCode, reason: CoachReason): string {
  const t = (key: TranslationKey, params?: Record<string, string | number>) => translate(locale, key, params);
  switch (reason.code) {
    case 'shorter_for_time':
      return t('reason.shorter_for_time', { minutes: reason.minutes });
    case 'reentry_after_break':
      return t(reason.days === null ? 'reason.reentry_after_break_unknown' : 'reason.reentry_after_break');
    case 'missed_not_doubled':
      return t('reason.missed_not_doubled', { missed: reason.missed });
    case 'variant_unavailable':
      return t('reason.variant_unavailable', { variant: translateDynamic(locale, `variant.${reason.variant}`).toLowerCase() });
    default:
      return translateDynamic(locale, `reason.${reason.code}`);
  }
}
