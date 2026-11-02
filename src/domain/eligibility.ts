import type { AppEnvironment, Constraints, Exercise, Familiarity } from './types';

export type IneligibleReason =
  | 'unknown_exercise'
  | 'not_approved'
  | 'excluded_exercise'
  | 'excluded_equipment'
  | 'equipment_unavailable'
  | 'equipment_occupied'
  | 'disabled_by_switch';

export interface EligibilityContext {
  constraints: Constraints;
  environment: AppEnvironment;
  /** Kill switch: exercise IDs that must never be assigned (ops feature switch). */
  disabledExerciseIds?: string[];
}

/**
 * Hard constraints. Every selection and every substitution goes through this
 * single function so no path can bypass an exclusion.
 */
export function checkEligibility(
  exercise: Exercise | undefined,
  ctx: EligibilityContext,
): { ok: true } | { ok: false; reason: IneligibleReason } {
  if (!exercise) return { ok: false, reason: 'unknown_exercise' };
  if (ctx.disabledExerciseIds?.includes(exercise.id)) return { ok: false, reason: 'disabled_by_switch' };
  // Only approved content may be assigned outside development. Rejected content is never assigned.
  if (exercise.reviewStatus === 'rejected') return { ok: false, reason: 'not_approved' };
  if (ctx.environment !== 'development' && exercise.reviewStatus !== 'approved') {
    return { ok: false, reason: 'not_approved' };
  }
  const c = ctx.constraints;
  if (c.excludedExerciseIds.includes(exercise.id)) return { ok: false, reason: 'excluded_exercise' };
  if (exercise.equipment.some((e) => c.excludedEquipment.includes(e))) {
    return { ok: false, reason: 'excluded_equipment' };
  }
  if (exercise.equipment.some((e) => !c.availableEquipment.includes(e))) {
    return { ok: false, reason: 'equipment_unavailable' };
  }
  if (exercise.equipment.some((e) => c.occupiedEquipment?.includes(e))) {
    return { ok: false, reason: 'equipment_occupied' };
  }
  return { ok: true };
}

const FAMILIARITY_RANK: Record<Familiarity, number> = { comfortable: 0, reminder: 1, new: 2 };

export function familiarityRank(familiarity: Record<string, Familiarity>, exerciseId: string): number {
  return FAMILIARITY_RANK[familiarity[exerciseId] ?? 'new'];
}
