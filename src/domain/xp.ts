/**
 * Habit XP. Awards are immutable ledger entries with unique keys, so replays,
 * retries and timezone changes cannot duplicate them. Training rewards are
 * capped to the agreed weekly schedule; effort, load, extra visits and longer
 * stays earn nothing extra. XP unlocks cosmetics only, never exercise difficulty.
 */
import { addDays, weekStart } from './dates';
import type { XpRules } from './rules';
import type { LocalDate, SessionOutcome, SessionVariant } from './types';

export type XpKind = 'check_in' | 'mission' | 'lesson' | 'rest_day_learning';

export interface LedgerEntry {
  awardKey: string;
  kind: XpKind;
  amount: number;
  localDate: LocalDate;
  sessionId: string | null;
  rulesVersion: string;
}

export type XpEvent =
  | { type: 'check_in'; localDate: LocalDate; sessionId: string; isTrainingDay: boolean }
  | { type: 'mission_complete'; localDate: LocalDate; sessionId: string; variant: SessionVariant; outcome: SessionOutcome }
  | { type: 'lesson_viewed'; localDate: LocalDate; exerciseId: string }
  | { type: 'rest_day_learning'; localDate: LocalDate; isTrainingDay: boolean };

function inWeek(entries: LedgerEntry[], kind: XpKind, date: LocalDate): number {
  const start = weekStart(date);
  const end = addDays(start, 6);
  return entries.filter((e) => e.kind === kind && e.localDate >= start && e.localDate <= end).length;
}

export function evaluateAward(
  event: XpEvent,
  ledger: LedgerEntry[],
  ctx: { daysPerWeek: number; rules: XpRules },
): LedgerEntry | null {
  const has = (key: string) => ledger.some((e) => e.awardKey === key);
  const base = { rulesVersion: ctx.rules.version, localDate: event.localDate };

  switch (event.type) {
    case 'check_in': {
      const awardKey = `check_in:${event.localDate}`;
      if (!event.isTrainingDay || has(awardKey)) return null;
      if (ledger.some((e) => e.kind === 'check_in' && e.sessionId === event.sessionId)) return null;
      if (inWeek(ledger, 'check_in', event.localDate) >= ctx.daysPerWeek) return null;
      return { ...base, awardKey, kind: 'check_in', amount: ctx.rules.checkIn, sessionId: event.sessionId };
    }
    case 'mission_complete': {
      // Only a completed assigned mission counts. Partial, abandoned and safety stops earn no
      // mission XP, but nothing already earned is ever taken away.
      if (event.outcome !== 'full' && event.outcome !== 'introductory') return null;
      const awardKey = `mission:${event.localDate}`;
      if (has(awardKey)) return null;
      if (ledger.some((e) => e.kind === 'mission' && e.sessionId === event.sessionId)) return null;
      if (inWeek(ledger, 'mission', event.localDate) >= ctx.daysPerWeek) return null;
      return { ...base, awardKey, kind: 'mission', amount: ctx.rules.mission, sessionId: event.sessionId };
    }
    case 'lesson_viewed': {
      const awardKey = `lesson:${event.localDate}`;
      if (has(awardKey)) return null;
      return { ...base, awardKey, kind: 'lesson', amount: ctx.rules.lesson, sessionId: null };
    }
    case 'rest_day_learning': {
      const awardKey = `rest_day_learning:${event.localDate}`;
      if (event.isTrainingDay || has(awardKey)) return null;
      return { ...base, awardKey, kind: 'rest_day_learning', amount: ctx.rules.restDayLearning, sessionId: null };
    }
  }
}

export function totalXp(ledger: LedgerEntry[]): number {
  return ledger.reduce((sum, e) => sum + e.amount, 0);
}

export function levelFor(total: number, rules: XpRules): { key: string; index: number; nextAt: number | null } {
  let index = 0;
  rules.levels.forEach((l, i) => {
    if (total >= l.minXp) index = i;
  });
  const next = rules.levels[index + 1];
  return { key: rules.levels[index].key, index, nextAt: next ? next.minXp : null };
}
