/**
 * Gentle progression from actual logged performance and plain-language effort
 * feedback. No one-rep-max testing and no starting weights inferred from sex,
 * body weight or appearance. Limits come from the (not yet reviewed) rules.
 */
import type { CoachRules } from './rules';
import type { Effort, LoadBasis, SlotPrescription, WeightUnit } from './types';
import { convert, roundForDisplay, type Weight } from './units';

export interface LoggedWorkingSet {
  reps: number;
  weight: Weight | null;
  effort: Effort | null;
}

export type LoadSuggestion =
  /** No relevant history: guided familiarisation, no number suggested. */
  | { kind: 'familiarise' }
  | { kind: 'bodyweight' }
  | { kind: 'suggest'; weight: Weight; change: 'increase' | 'hold' | 'decrease' | 'reentry' };

function step(basis: LoadBasis, unit: WeightUnit, rules: CoachRules): number {
  const dumbbell = basis === 'per_hand';
  if (unit === 'kg') return dumbbell ? rules.increment.dumbbellKg : rules.increment.machineKg;
  return dumbbell ? rules.increment.dumbbellLb : rules.increment.machineLb;
}

export function suggestLoad(input: {
  lastSessionSets: LoggedWorkingSet[];
  prescription: SlotPrescription;
  loadBasis: LoadBasis | 'bodyweight';
  preferredUnit: WeightUnit;
  reentry: boolean;
  rules: CoachRules;
}): LoadSuggestion {
  if (input.loadBasis === 'bodyweight') return { kind: 'bodyweight' };
  const weighted = input.lastSessionSets.filter((s) => s.weight !== null);
  if (weighted.length === 0) return { kind: 'familiarise' };

  const last = weighted[weighted.length - 1].weight as Weight;
  const unit = input.preferredUnit;
  const base = roundForDisplay(convert(last.value, last.unit, unit), unit);
  const inc = step(input.loadBasis, unit, input.rules);
  const make = (value: number, change: 'increase' | 'hold' | 'decrease' | 'reentry'): LoadSuggestion => ({
    kind: 'suggest',
    weight: { value: Math.max(0, roundForDisplay(value, unit)), unit, basis: input.loadBasis as LoadBasis },
    change,
  });

  if (input.reentry) return make(base * input.rules.reentryLoadFactor, 'reentry');

  const { repsMin, repsMax } = input.prescription;
  const allHitTop = weighted.every((s) => s.reps >= repsMax);
  const anyMissedBottom = weighted.some((s) => s.reps < repsMin);
  const anyHard = weighted.some((s) => s.effort === 'hard');
  const allEasy = weighted.every((s) => s.effort === 'easy');

  if (anyMissedBottom && anyHard) return make(base * input.rules.reductionFactor, 'decrease');
  // Increase only when every set reached the top of the range AND felt comfortable.
  if (allHitTop && allEasy) return make(base + inc, 'increase');
  return make(base, 'hold');
}
