import { addDays, daysBetween, isWithin, weekdayOf, weekStart } from './dates';
import type { CoachRules } from './rules';
import type { CompletedSession, LocalDate, UserProgramme, Weekday } from './types';

export type DayStatus =
  | { kind: 'paused'; until: LocalDate | null }
  | { kind: 'completed_today'; session: CompletedSession }
  | {
      kind: 'training';
      reason: 'planned_day' | 'rescheduled';
      missedPlanned: number;
      daysSinceLast: number | null;
      longBreak: boolean;
    }
  | {
      kind: 'rest';
      reason: 'planned_rest' | 'recovery' | 'weekly_target_met';
      missedPlanned: number;
      nextTrainingDate: LocalDate | null;
      /** The user may choose to move this week's next session to today. */
      canMoveSessionToday: boolean;
    };

/** Outcomes that count as having attended a session (recorded separately elsewhere). */
export function countsAsAttendance(s: CompletedSession): boolean {
  return s.outcome === 'full' || s.outcome === 'partial' || s.outcome === 'introductory';
}

export function lastAttended(history: CompletedSession[], before?: LocalDate): CompletedSession | null {
  let last: CompletedSession | null = null;
  for (const s of history) {
    if (!countsAsAttendance(s)) continue;
    if (before && s.localDate >= before) continue;
    if (!last || s.localDate > last.localDate) last = s;
  }
  return last;
}

export function isPaused(programme: UserProgramme, date: LocalDate): boolean {
  return programme.pause !== null && isWithin(date, programme.pause.from, programme.pause.until);
}

export function attendedInWeek(history: CompletedSession[], date: LocalDate): number {
  const start = weekStart(date);
  const end = addDays(start, 6);
  const days = new Set(
    history.filter((s) => countsAsAttendance(s) && s.localDate >= start && s.localDate <= end).map((s) => s.localDate),
  );
  return days.size;
}

/**
 * Planned weekdays between the last attended session and today (exclusive)
 * that had no session. Only looks back two weeks; older misses are captured by
 * the long-break rule instead. A missed session never adds volume.
 */
export function countMissedPlanned(programme: UserProgramme, history: CompletedSession[], today: LocalDate): number {
  const last = lastAttended(history, today);
  let from = addDays(today, -14);
  if (last && last.localDate >= from) from = addDays(last.localDate, 1);
  if (programme.startDate > from) from = programme.startDate;
  let missed = 0;
  for (let d = from; d < today; d = addDays(d, 1)) {
    if (isPaused(programme, d)) continue;
    if (programme.preferredWeekdays.includes(weekdayOf(d))) missed += 1;
  }
  return missed;
}

function recoveryOk(history: CompletedSession[], date: LocalDate, rules: CoachRules): boolean {
  const last = lastAttended(history, date);
  return !last || daysBetween(last.localDate, date) > rules.minRestDaysBetweenSessions;
}

export function nextTrainingDate(
  programme: UserProgramme,
  history: CompletedSession[],
  after: LocalDate,
  rules: CoachRules,
): LocalDate | null {
  for (let i = 1; i <= 28; i++) {
    const d = addDays(after, i);
    if (isPaused(programme, d)) continue;
    if (!programme.preferredWeekdays.includes(weekdayOf(d))) continue;
    if (!recoveryOk(history, d, rules)) continue;
    return d;
  }
  return null;
}

export function evaluateDay(input: {
  programme: UserProgramme;
  history: CompletedSession[];
  today: LocalDate;
  rescheduledDates: LocalDate[];
  rules: CoachRules;
}): DayStatus {
  const { programme, history, today, rules } = input;
  if (isPaused(programme, today)) return { kind: 'paused', until: programme.pause?.until ?? null };

  const todays = history.filter((s) => s.localDate === today && s.outcome !== 'abandoned');
  if (todays.length > 0) return { kind: 'completed_today', session: todays[todays.length - 1] };

  const missedPlanned = countMissedPlanned(programme, history, today);
  const last = lastAttended(history, today);
  const daysSinceLast = last ? daysBetween(last.localDate, today) : null;
  const weeklyTargetMet = attendedInWeek(history, today) >= programme.daysPerWeek;
  const next = () => nextTrainingDate(programme, history, today, rules);

  if (!recoveryOk(history, today, rules)) {
    return { kind: 'rest', reason: 'recovery', missedPlanned, nextTrainingDate: next(), canMoveSessionToday: false };
  }
  if (weeklyTargetMet) {
    return { kind: 'rest', reason: 'weekly_target_met', missedPlanned, nextTrainingDate: next(), canMoveSessionToday: false };
  }
  const longBreak = daysSinceLast !== null && daysSinceLast >= rules.longBreakDays;
  if (programme.preferredWeekdays.includes(weekdayOf(today)) || input.rescheduledDates.includes(today)) {
    return {
      kind: 'training',
      reason: programme.preferredWeekdays.includes(weekdayOf(today)) ? 'planned_day' : 'rescheduled',
      missedPlanned,
      daysSinceLast,
      longBreak,
    };
  }
  return { kind: 'rest', reason: 'planned_rest', missedPlanned, nextTrainingDate: next(), canMoveSessionToday: true };
}

/** Next session key from actual completion history, not from calendar dates. */
export function nextSessionKey(rotation: string[], history: CompletedSession[]): string {
  const last = lastAttended(history);
  if (!last) return rotation[0];
  const idx = rotation.indexOf(last.sessionKey);
  return rotation[(idx + 1) % rotation.length];
}

/** 2 or 3 training days with at least one rest day between any two (including Sunday→Monday). */
export function validateWeekdays(days: Weekday[]): boolean {
  if (days.length < 2 || days.length > 3) return false;
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length !== days.length) return false;
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length] + (i + 1 === sorted.length ? 7 : 0);
    if (next - sorted[i] < 2) return false;
  }
  return true;
}
