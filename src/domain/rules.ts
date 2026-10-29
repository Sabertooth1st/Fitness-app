/**
 * Versioned rule configuration for scheduling, adaptation, progression and XP.
 *
 * REVIEW STATUS: NOT REVIEWED. These numbers are provisional development
 * defaults chosen by the engineering team. They must be reviewed and approved
 * by a qualified exercise professional before production recommendations use
 * them. See docs/CONTENT_REVIEW.md.
 */
import type { ReviewStatus } from './types';

export interface CoachRules {
  version: string;
  reviewStatus: ReviewStatus;
  /** Minimum full rest days between two resistance sessions. */
  minRestDaysBetweenSessions: number;
  /** Days since last completed training that count as a long break. */
  longBreakDays: number;
  /** Fraction of the previous working load suggested after a long break. */
  reentryLoadFactor: number;
  /** Load increase steps used by gentle progression. */
  increment: { machineKg: number; machineLb: number; dumbbellKg: number; dumbbellLb: number };
  /** Fraction to reduce load when the user reports a set was hard and missed the range. */
  reductionFactor: number;
}

export const COACH_RULES: CoachRules = {
  version: 'coach-rules-0.1.0-dev',
  reviewStatus: 'not_reviewed',
  minRestDaysBetweenSessions: 1,
  longBreakDays: 14,
  reentryLoadFactor: 0.7,
  increment: { machineKg: 2.5, machineLb: 5, dumbbellKg: 1, dumbbellLb: 2.5 },
  reductionFactor: 0.9,
};

export interface XpRules {
  version: string;
  checkIn: number;
  mission: number;
  lesson: number;
  restDayLearning: number;
  levels: { key: string; minXp: number }[];
}

/** Product rules from the build brief (section 4). Cosmetic only. */
export const XP_RULES: XpRules = {
  version: 'xp-rules-1.0.0',
  checkIn: 10,
  mission: 30,
  lesson: 5,
  restDayLearning: 5,
  levels: [
    { key: 'first_step', minXp: 0 },
    { key: 'finding_your_feet', minXp: 100 },
    { key: 'building_rhythm', minXp: 300 },
    { key: 'growing_confidence', minXp: 600 },
    { key: 'independent_trainee', minXp: 1000 },
  ],
};

export interface CheckInRules {
  /** UX heuristic, not fraud protection. Needs field testing at real gyms. */
  radiusMeters: number;
  maxSampleAgeMs: number;
  maxAccuracyMeters: number;
  timeoutMs: number;
}

export const CHECK_IN_RULES: CheckInRules = {
  radiusMeters: 150,
  maxSampleAgeMs: 60_000,
  maxAccuracyMeters: 100,
  timeoutMs: 15_000,
};
