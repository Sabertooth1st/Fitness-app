import * as Location from 'expo-location';
import { evaluateProximity, type GymPin, type PositionSample, type ProximityResult } from '../../domain/checkIn';
import type { CheckInRules } from '../../domain/rules';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([promise, new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms))]);
}

/**
 * Foreground-only permission. Asks only when the OS still allows asking, and
 * only after the user tapped the location option. Never background location.
 */
export async function ensureForegroundPermission(): Promise<boolean> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === 'granted') return true;
    if (!current.canAskAgain) return false;
    const requested = await Location.requestForegroundPermissionsAsync();
    return requested.status === 'granted';
  } catch {
    return false;
  }
}

/** One fresh reading; null when unavailable. */
export async function readPosition(timeoutMs: number): Promise<PositionSample | 'timeout' | null> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) return null;
    const r = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeoutMs);
    if (r === 'timeout') return 'timeout';
    return { latitude: r.coords.latitude, longitude: r.coords.longitude, accuracy: r.coords.accuracy ?? null, timestamp: r.timestamp };
  } catch {
    return null;
  }
}

export async function checkProximity(pin: GymPin | null, rules: CheckInRules): Promise<ProximityResult> {
  if (!pin) return { status: 'uncertain', reason: 'no_pin' };
  if (!(await ensureForegroundPermission())) return { status: 'uncertain', reason: 'permission_denied' };
  const sample = await readPosition(rules.timeoutMs);
  if (sample === 'timeout') return { status: 'uncertain', reason: 'timeout' };
  return evaluateProximity({ pin, sample, now: Date.now(), rules });
}
