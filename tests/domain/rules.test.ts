import { evaluateProximity } from '../../src/domain/checkIn';
import { addDays, daysBetween, toLocalDate, weekdayOf, weekStart } from '../../src/domain/dates';
import { suggestLoad } from '../../src/domain/progression';
import { CHECK_IN_RULES, COACH_RULES, XP_RULES } from '../../src/domain/rules';
import { evaluateDay } from '../../src/domain/schedule';
import { findSubstitute } from '../../src/domain/substitution';
import { convert, toDisplay, totalLoad } from '../../src/domain/units';
import { evaluateAward, levelFor, totalXp, type LedgerEntry, type XpEvent } from '../../src/domain/xp';
import { DEV_CATALOGUE } from '../../src/content/exercises.dev';
import { ALL_EQUIPMENT } from '../../src/domain/types';
import { coachInput, MON, session, TUE, WED } from './fixtures';

describe('dates', () => {
  it('computes local dates across timezones and DST', () => {
    // 2026-10-25 01:30 UTC is after the EU DST change (01:00 UTC).
    expect(toLocalDate(new Date('2026-10-24T23:30:00Z'), 'Europe/Zurich')).toBe('2026-10-25');
    expect(toLocalDate(new Date('2026-10-24T23:30:00Z'), 'America/New_York')).toBe('2026-10-24');
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(weekdayOf(MON)).toBe(1);
    expect(weekStart('2026-11-08')).toBe(MON);
  });
});

describe('schedule', () => {
  const programme = coachInput().programme;
  it('requires recovery between sessions even on a rescheduled day', () => {
    const d = evaluateDay({ programme, history: [session(MON)], today: TUE, rescheduledDates: [TUE], rules: COACH_RULES });
    expect(d).toMatchObject({ kind: 'rest', reason: 'recovery', canMoveSessionToday: false });
  });
  it('stops at the weekly target', () => {
    const history = [session('2026-10-26'), session('2026-10-28'), session('2026-10-30')];
    const d = evaluateDay({ programme: { ...programme, preferredWeekdays: [1, 3, 5, 7] }, history, today: '2026-11-01', rescheduledDates: [], rules: COACH_RULES });
    expect(d).toMatchObject({ kind: 'rest', reason: 'weekly_target_met' });
  });
  it('reports a completed day once a session exists, including safety stops', () => {
    const d = evaluateDay({ programme, history: [session(MON, { outcome: 'safety_stop' })], today: MON, rescheduledDates: [], rules: COACH_RULES });
    expect(d.kind).toBe('completed_today');
  });
});

describe('substitution (acceptance 5, 6)', () => {
  const ctx = {
    constraints: { availableEquipment: [...ALL_EQUIPMENT], excludedExerciseIds: [] as string[], excludedEquipment: [] as never[] },
    environment: 'development' as const,
  };
  const active = [
    { exerciseId: 'leg_press', loggedSets: 0, status: 'pending' as const },
    { exerciseId: 'machine_chest_press', loggedSets: 1, status: 'in_progress' as const },
  ];

  it('busy machine gets an approved alternative using other equipment', () => {
    const r = findSubstitute({ session: active, index: 0, trigger: 'busy', catalogue: DEV_CATALOGUE, familiarity: {}, ctx });
    expect(r).toEqual({ ok: true, replacementId: 'goblet_squat', reason: 'approved_alternative' });
  });

  it('too hard prefers an approved regression', () => {
    const r = findSubstitute({ session: active, index: 1, trigger: 'too_hard', catalogue: DEV_CATALOGUE, familiarity: {}, ctx });
    expect(r).toEqual({ ok: true, replacementId: 'incline_push_up', reason: 'approved_regression' });
  });

  it('re-checks exclusions on every substitution', () => {
    const r = findSubstitute({
      session: active,
      index: 0,
      trigger: 'busy',
      catalogue: DEV_CATALOGUE,
      familiarity: {},
      ctx: { ...ctx, constraints: { ...ctx.constraints, excludedEquipment: ['dumbbells'], excludedExerciseIds: ['box_squat'] } },
    });
    expect(r).toEqual({ ok: true, replacementId: 'sit_to_stand', reason: 'approved_regression' });
  });

  it('returns no_valid_substitute rather than an unsafe guess', () => {
    const r = findSubstitute({
      session: [{ exerciseId: 'seated_leg_curl', loggedSets: 0, status: 'pending' }],
      index: 0,
      trigger: 'busy',
      catalogue: DEV_CATALOGUE,
      familiarity: {},
      ctx,
    });
    expect(r).toEqual({ ok: false, reason: 'no_valid_substitute' });
  });

  it('cannot replace a finished exercise', () => {
    const r = findSubstitute({ session: [{ exerciseId: 'leg_press', loggedSets: 3, status: 'done' }], index: 0, trigger: 'busy', catalogue: DEV_CATALOGUE, familiarity: {}, ctx });
    expect(r.ok).toBe(false);
  });
});

describe('units (acceptance 14)', () => {
  it('round-trips without corrupting stored values', () => {
    const stored = { value: 12.5, unit: 'kg' as const, basis: 'per_hand' as const };
    const lb = toDisplay(stored, 'lb');
    expect(lb).toEqual({ value: 28, unit: 'lb', basis: 'per_hand' });
    // Display conversion never mutates the stored record.
    expect(stored.value).toBe(12.5);
    expect(toDisplay(stored, 'kg')).toBe(stored);
    expect(convert(convert(100, 'kg', 'lb'), 'lb', 'kg')).toBeCloseTo(100, 10);
  });
  it('doubles per-hand dumbbells only for explicit totals', () => {
    expect(totalLoad({ value: 10, unit: 'kg', basis: 'per_hand' })).toBe(20);
    expect(totalLoad({ value: 40, unit: 'kg', basis: 'machine_stack' })).toBe(40);
  });
});

describe('progression', () => {
  const prescription = { sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90, setKind: 'working' as const };
  const w = (value: number) => ({ value, unit: 'kg' as const, basis: 'machine_stack' as const });
  it('asks for familiarisation without history and never infers a starting weight', () => {
    expect(suggestLoad({ lastSessionSets: [], prescription, loadBasis: 'machine_stack', preferredUnit: 'kg', reentry: false, rules: COACH_RULES })).toEqual({ kind: 'familiarise' });
  });
  it('increases only when all sets hit the top and felt easy', () => {
    const sets = [12, 12, 12].map((reps) => ({ reps, weight: w(30), effort: 'easy' as const }));
    expect(suggestLoad({ lastSessionSets: sets, prescription, loadBasis: 'machine_stack', preferredUnit: 'kg', reentry: false, rules: COACH_RULES })).toMatchObject({ change: 'increase', weight: { value: 32.5 } });
    const mixed = [...sets.slice(0, 2), { reps: 12, weight: w(30), effort: 'about_right' as const }];
    expect(suggestLoad({ lastSessionSets: mixed, prescription, loadBasis: 'machine_stack', preferredUnit: 'kg', reentry: false, rules: COACH_RULES })).toMatchObject({ change: 'hold' });
  });
  it('reduces load after a long break', () => {
    const sets = [{ reps: 10, weight: w(40), effort: 'about_right' as const }];
    expect(suggestLoad({ lastSessionSets: sets, prescription, loadBasis: 'machine_stack', preferredUnit: 'kg', reentry: true, rules: COACH_RULES })).toMatchObject({ change: 'reentry', weight: { value: 28 } });
  });
});

describe('XP (acceptance 12, 15)', () => {
  const ctx = { daysPerWeek: 3, rules: XP_RULES };
  function apply(events: XpEvent[]): LedgerEntry[] {
    const ledger: LedgerEntry[] = [];
    for (const e of events) {
      const a = evaluateAward(e, ledger, ctx);
      if (a) ledger.push(a);
    }
    return ledger;
  }

  it('awards check-in, mission and one lesson per day', () => {
    const ledger = apply([
      { type: 'check_in', localDate: MON, sessionId: 's1', isTrainingDay: true },
      { type: 'lesson_viewed', localDate: MON, exerciseId: 'leg_press' },
      { type: 'lesson_viewed', localDate: MON, exerciseId: 'lat_pulldown' },
      { type: 'mission_complete', localDate: MON, sessionId: 's1', variant: 'short', outcome: 'full' },
    ]);
    expect(totalXp(ledger)).toBe(45);
  });

  it('replayed operations do not duplicate awards', () => {
    const e: XpEvent = { type: 'mission_complete', localDate: MON, sessionId: 's1', variant: 'standard', outcome: 'full' };
    expect(apply([e, e, e])).toHaveLength(1);
  });

  it('a timezone change producing a different local date cannot double-award the same session', () => {
    const ledger = apply([
      { type: 'mission_complete', localDate: MON, sessionId: 's1', variant: 'standard', outcome: 'full' },
      { type: 'mission_complete', localDate: TUE, sessionId: 's1', variant: 'standard', outcome: 'full' },
    ]);
    expect(ledger).toHaveLength(1);
  });

  it('caps training rewards to the weekly target', () => {
    const days = [MON, TUE, WED, '2026-11-05', '2026-11-06'];
    const ledger = apply(days.map((d, i) => ({ type: 'mission_complete', localDate: d, sessionId: `s${i}`, variant: 'standard', outcome: 'full' }) as XpEvent));
    expect(ledger).toHaveLength(3);
  });

  it('gives no mission XP for partial or safety stops, and takes nothing away', () => {
    const ledger = apply([
      { type: 'check_in', localDate: MON, sessionId: 's1', isTrainingDay: true },
      { type: 'mission_complete', localDate: MON, sessionId: 's1', variant: 'standard', outcome: 'safety_stop' },
    ]);
    expect(totalXp(ledger)).toBe(10);
  });

  it('rest-day learning only on non-training days', () => {
    expect(apply([{ type: 'rest_day_learning', localDate: TUE, isTrainingDay: true }])).toHaveLength(0);
    expect(apply([{ type: 'rest_day_learning', localDate: TUE, isTrainingDay: false }])).toHaveLength(1);
  });

  it('levels never decrease and are cosmetic', () => {
    expect(levelFor(0, XP_RULES).key).toBe('first_step');
    expect(levelFor(150, XP_RULES)).toEqual({ key: 'finding_your_feet', index: 1, nextAt: 300 });
    expect(levelFor(5000, XP_RULES).nextAt).toBeNull();
  });
});

describe('check-in proximity (acceptance 2)', () => {
  const pin = { latitude: 47.3769, longitude: 8.5417 };
  const now = 1_000_000;
  const sample = (over: object = {}) => ({ latitude: 47.3770, longitude: 8.5418, accuracy: 20, timestamp: now - 1000, ...over });
  const r = (s: ReturnType<typeof sample> | null, p = pin) => evaluateProximity({ pin: p, sample: s, now, rules: CHECK_IN_RULES });

  it('near within radius', () => expect(r(sample()).status).toBe('near'));
  it('stale sample is uncertain', () => expect(r(sample({ timestamp: now - 120_000 }))).toEqual({ status: 'uncertain', reason: 'stale' }));
  it('poor accuracy is uncertain', () => expect(r(sample({ accuracy: 500 }))).toEqual({ status: 'uncertain', reason: 'poor_accuracy' }));
  it('missing accuracy is uncertain', () => expect(r(sample({ accuracy: null }))).toEqual({ status: 'uncertain', reason: 'poor_accuracy' }));
  it('no sample is uncertain', () => expect(r(null)).toEqual({ status: 'uncertain', reason: 'unavailable' }));
  it('far away is far', () => expect(r(sample({ latitude: 47.4 })).status).toBe('far'));
});
