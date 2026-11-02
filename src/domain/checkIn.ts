/**
 * Location-assisted check-in evaluation. A UX convenience only: it is not
 * fraud protection and never proves a workout happened. Every non-"near"
 * result keeps the manual route available.
 */
import type { CheckInRules } from './rules';

export interface GymPin {
  latitude: number;
  longitude: number;
}

export interface PositionSample {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy radius in metres, if the platform reported one. */
  accuracy: number | null;
  timestamp: number;
}

export type ProximityResult =
  | { status: 'near'; distanceMeters: number }
  | { status: 'far'; distanceMeters: number }
  | {
      status: 'uncertain';
      reason: 'no_pin' | 'permission_denied' | 'timeout' | 'unavailable' | 'stale' | 'poor_accuracy';
    };

export function distanceMeters(a: GymPin, b: GymPin): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function evaluateProximity(input: {
  pin: GymPin | null;
  sample: PositionSample | null;
  now: number;
  rules: CheckInRules;
}): ProximityResult {
  if (!input.pin) return { status: 'uncertain', reason: 'no_pin' };
  if (!input.sample) return { status: 'uncertain', reason: 'unavailable' };
  if (input.now - input.sample.timestamp > input.rules.maxSampleAgeMs) return { status: 'uncertain', reason: 'stale' };
  if (input.sample.accuracy === null || input.sample.accuracy > input.rules.maxAccuracyMeters) {
    return { status: 'uncertain', reason: 'poor_accuracy' };
  }
  const d = distanceMeters(input.pin, input.sample);
  // Within radius, allowing for the reported uncertainty.
  if (d <= input.rules.radiusMeters) return { status: 'near', distanceMeters: d };
  if (d - input.sample.accuracy <= input.rules.radiusMeters) return { status: 'uncertain', reason: 'poor_accuracy' };
  return { status: 'far', distanceMeters: d };
}
