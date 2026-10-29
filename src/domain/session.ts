import type { SessionOutcome, SessionVariant, SlotPrescription } from './types';

export interface ExerciseProgress {
  status: 'pending' | 'in_progress' | 'done' | 'replaced' | 'skipped';
  prescription: SlotPrescription;
  loggedSets: number;
}

/**
 * Honest outcome classification. Introductory, partial and full sessions stay
 * distinct even where the habit reward is equivalent.
 */
export function classifyOutcome(variant: SessionVariant, exercises: ExerciseProgress[]): SessionOutcome {
  if (variant === 'introductory') return 'introductory';
  const active = exercises.filter((e) => e.status !== 'replaced');
  const anySets = exercises.some((e) => e.loggedSets > 0);
  if (!anySets) return 'abandoned';
  const complete = active.every((e) => e.status !== 'skipped' && e.loggedSets >= e.prescription.sets);
  return complete ? 'full' : 'partial';
}
