import type { LoadBasis, WeightUnit } from './types';

const LB_PER_KG = 2.20462262185;

/**
 * Logged weights are stored exactly as entered (value + unit + basis) and only
 * converted for display, so repeated kg/lb switching never corrupts history.
 */
export interface Weight {
  value: number;
  unit: WeightUnit;
  basis: LoadBasis;
}

export function convert(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === 'kg' ? value * LB_PER_KG : value / LB_PER_KG;
}

/** Round to the nearest practical step: 0.5 kg or 1 lb. */
export function roundForDisplay(value: number, unit: WeightUnit): number {
  const step = unit === 'kg' ? 0.5 : 1;
  return Math.round(value / step) * step;
}

export function toDisplay(weight: Weight, unit: WeightUnit): Weight {
  if (weight.unit === unit) return weight;
  return { value: roundForDisplay(convert(weight.value, weight.unit, unit), unit), unit, basis: weight.basis };
}

/**
 * Total external load. Per-hand dumbbell weights are doubled only here, for
 * explicit totals; the stored per-hand value never changes.
 */
export function totalLoad(weight: Weight): number {
  return weight.basis === 'per_hand' ? weight.value * 2 : weight.value;
}

export function isValidWeight(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1000;
}
