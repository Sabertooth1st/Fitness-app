/**
 * Motivation rules for the days people don't feel like going. The answer is
 * always a smaller session that still counts, never extra volume, and never a
 * reason to train through pain (that path goes to the safety stop).
 */
import { addDays, weekStart } from './dates';
import { countsAsAttendance, isPaused } from './schedule';
import type { CompletedSession, LocalDate, UserProgramme } from './types';

export type HardDayReason = 'no_energy' | 'no_time' | 'no_motivation' | 'stressed' | 'sore';
export const HARD_DAY_REASONS: HardDayReason[] = ['no_motivation', 'no_energy', 'no_time', 'stressed', 'sore'];

export interface HardDayPlan {
  /** Minutes passed to Comeback Coach, which picks the reviewed short variant. */
  minutes: number;
  /** The smallest commitment: start the first exercise; everything after is a bonus. */
  commitment: 'first_exercise' | 'short_session';
}

export function hardDayPlan(reason: HardDayReason): HardDayPlan {
  switch (reason) {
    case 'no_time':
      return { minutes: 20, commitment: 'short_session' };
    case 'sore':
      // Ordinary muscle soreness: lighter, shorter work. Pain is handled by the safety question.
      return { minutes: 20, commitment: 'short_session' };
    default:
      return { minutes: 20, commitment: 'first_exercise' };
  }
}

/** Badge thresholds for sessions completed on a day the user marked as hard. */
export const HARD_DAY_MILESTONES = [1, 5, 10, 25, 50, 100];

export function hardDayMilestoneKey(count: number): string | null {
  return HARD_DAY_MILESTONES.includes(count) ? `hard_day_${count}` : null;
}

export function hardDayWins(history: CompletedSession[]): number {
  return history.filter((s) => s.hardDay && countsAsAttendance(s)).length;
}

function weekMet(programme: UserProgramme, history: CompletedSession[], start: LocalDate): boolean {
  const end = addDays(start, 6);
  const days = new Set(history.filter((s) => countsAsAttendance(s) && s.localDate >= start && s.localDate <= end).map((s) => s.localDate));
  return days.size >= programme.daysPerWeek;
}

function weekPaused(programme: UserProgramme, start: LocalDate): boolean {
  for (let i = 0; i < 7; i++) if (isPaused(programme, addDays(start, i))) return true;
  return false;
}

/**
 * Consecutive weeks that hit the weekly target, ending with the current week
 * if it is already met, otherwise with last week. Paused weeks are skipped,
 * not counted as breaks: holidays and illness are part of the plan.
 */
export function weeksInARow(programme: UserProgramme, history: CompletedSession[], today: LocalDate): number {
  let start = weekStart(today);
  if (!weekMet(programme, history, start)) start = addDays(start, -7);
  let n = 0;
  for (let i = 0; i < 520; i++) {
    if (start < weekStart(programme.startDate)) break;
    if (weekMet(programme, history, start)) n += 1;
    else if (!weekPaused(programme, start)) break;
    start = addDays(start, -7);
  }
  return n;
}

/** Deterministic pick so the same line shows all day. */
export function dailyIndex(date: LocalDate, count: number): number {
  let h = 0;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % count;
}
