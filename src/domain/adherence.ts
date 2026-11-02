import { addDays, weekStart } from './dates';
import { countsAsAttendance, isPaused } from './schedule';
import type { CompletedSession, LocalDate, UserProgramme } from './types';

export interface WeekSummary {
  weekStart: LocalDate;
  attended: number;
  target: number;
  pausedDays: number;
  outcomes: { full: number; partial: number; introductory: number; safety_stop: number };
}

/** "2 of 3 planned sessions this week". Pause days are reported separately. */
export function summariseWeek(programme: UserProgramme, history: CompletedSession[], date: LocalDate): WeekSummary {
  const start = weekStart(date);
  const end = addDays(start, 6);
  const inWeek = history.filter((s) => s.localDate >= start && s.localDate <= end);
  let pausedDays = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (isPaused(programme, d)) pausedDays += 1;
  const count = (o: CompletedSession['outcome']) => inWeek.filter((s) => s.outcome === o).length;
  return {
    weekStart: start,
    attended: new Set(inWeek.filter(countsAsAttendance).map((s) => s.localDate)).size,
    target: programme.daysPerWeek,
    pausedDays,
    outcomes: { full: count('full'), partial: count('partial'), introductory: count('introductory'), safety_stop: count('safety_stop') },
  };
}

/** Lifetime weeks in which the weekly target was met. Never decreases. */
export function completedWeeks(programme: UserProgramme, history: CompletedSession[]): number {
  const weeks = new Map<LocalDate, Set<LocalDate>>();
  for (const s of history) {
    if (!countsAsAttendance(s)) continue;
    const w = weekStart(s.localDate);
    if (!weeks.has(w)) weeks.set(w, new Set());
    weeks.get(w)!.add(s.localDate);
  }
  let n = 0;
  for (const days of weeks.values()) if (days.size >= programme.daysPerWeek) n += 1;
  return n;
}

/** Welcome-back is a one-time milestone, never a repeatable XP bonus. */
export function earnsWelcomeBack(alreadyEarned: boolean, isReturn: boolean, outcome: CompletedSession['outcome']): boolean {
  return !alreadyEarned && isReturn && countsAsAttendance({ outcome } as CompletedSession);
}
