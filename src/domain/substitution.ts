import { checkEligibility, familiarityRank, type EligibilityContext } from './eligibility';
import type { Equipment, Exercise, Familiarity } from './types';

export type SubstitutionTrigger = 'busy' | 'too_hard' | 'unsure';

export interface ActiveExerciseRef {
  exerciseId: string;
  /** Sets already logged against this exercise; they are never modified. */
  loggedSets: number;
  status: 'pending' | 'in_progress' | 'done' | 'replaced' | 'skipped';
}

export type SubstitutionResult =
  | { ok: true; replacementId: string; reason: 'approved_alternative' | 'approved_regression' }
  | { ok: false; reason: 'no_valid_substitute' | 'already_done' };

/**
 * Pick an approved replacement for one exercise. Only approved relationships
 * are used (never random), every hard constraint is re-checked, and nothing
 * else in the active workout changes.
 */
export function findSubstitute(input: {
  session: ActiveExerciseRef[];
  index: number;
  trigger: SubstitutionTrigger;
  catalogue: Record<string, Exercise>;
  familiarity: Record<string, Familiarity>;
  ctx: EligibilityContext;
}): SubstitutionResult {
  const current = input.session[input.index];
  if (!current || current.status === 'done' || current.status === 'replaced') return { ok: false, reason: 'already_done' };
  const exercise = input.catalogue[current.exerciseId];
  if (!exercise) return { ok: false, reason: 'no_valid_substitute' };

  const occupied: Equipment[] = [...(input.ctx.constraints.occupiedEquipment ?? [])];
  if (input.trigger === 'busy') occupied.push(...exercise.equipment);
  const ctx: EligibilityContext = { ...input.ctx, constraints: { ...input.ctx.constraints, occupiedEquipment: occupied } };

  const inSession = new Set(input.session.filter((e) => e.status !== 'replaced').map((e) => e.exerciseId));
  const tagged: { id: string; kind: 'approved_alternative' | 'approved_regression' }[] =
    input.trigger === 'busy'
      ? [
          ...exercise.alternatives.map((id) => ({ id, kind: 'approved_alternative' as const })),
          ...exercise.regressions.map((id) => ({ id, kind: 'approved_regression' as const })),
        ]
      : [
          ...exercise.regressions.map((id) => ({ id, kind: 'approved_regression' as const })),
          ...exercise.alternatives.map((id) => ({ id, kind: 'approved_alternative' as const })),
        ];

  const valid = tagged.filter(({ id }) => {
    if (inSession.has(id)) return false;
    const candidate = input.catalogue[id];
    // Substitutes must train the same movement pattern.
    if (!candidate || candidate.pattern !== exercise.pattern) return false;
    return checkEligibility(candidate, ctx).ok;
  });
  if (valid.length === 0) return { ok: false, reason: 'no_valid_substitute' };

  const ranked =
    input.trigger === 'unsure'
      ? [...valid].sort((a, b) => familiarityRank(input.familiarity, a.id) - familiarityRank(input.familiarity, b.id))
      : valid;
  return { ok: true, replacementId: ranked[0].id, reason: ranked[0].kind };
}
