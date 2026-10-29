import { decideSession } from '../../src/domain/coach';
import { DEV_CATALOGUE } from '../../src/content/exercises.dev';
import { FULL_BODY_TEMPLATE_DEV } from '../../src/content/templates.dev';
import { coachInput, FRI, MON, session, THU, TUE, WED } from './fixtures';

function totalSets(d: ReturnType<typeof decideSession>): number {
  return d.kind === 'train' ? d.exercises.reduce((n, e) => n + e.prescription.sets, 0) : 0;
}

describe('Comeback Coach', () => {
  it('assigns a standard session on a planned day with enough time', () => {
    const d = decideSession(coachInput());
    expect(d.kind).toBe('train');
    if (d.kind !== 'train') return;
    expect(d.variant).toBe('standard');
    expect(d.sessionKey).toBe('A');
    expect(d.reasons[0]).toEqual({ code: 'standard_session' });
  });

  it('safety concern outranks everything (acceptance 9)', () => {
    const d = decideSession(coachInput({ safety: 'concern', feeling: 'comfortable' }));
    expect(d).toEqual({ kind: 'safety_stop', reasons: [{ code: 'safety_stop' }] });
  });

  it('rest day does not assign training for engagement (acceptance 4)', () => {
    const d = decideSession(coachInput({ today: TUE, history: [session(MON)] }));
    expect(d.kind).toBe('not_today');
  });

  it('selects the reviewed short variant when time is limited', () => {
    const d = decideSession(coachInput({ availableMinutes: 20 }));
    expect(d.kind === 'train' && d.variant).toBe('short');
    expect(d.reasons).toContainEqual({ code: 'shorter_for_time', minutes: 20 });
  });

  it('a missed session does not double the next session (acceptance 7)', () => {
    const baseline = decideSession(coachInput({ today: FRI, history: [session(MON), session(WED, { sessionKey: 'B' })] }));
    // Missed Wednesday: Friday must not contain more work than an ordinary session.
    const afterMiss = decideSession(coachInput({ today: FRI, history: [session(MON)] }));
    expect(afterMiss.kind).toBe('train');
    if (afterMiss.kind !== 'train' || baseline.kind !== 'train') return;
    expect(afterMiss.reasons).toContainEqual({ code: 'missed_not_doubled', missed: 1 });
    const standardMax = Math.max(
      ...FULL_BODY_TEMPLATE_DEV.sessions.filter((s) => s.variant === 'standard').map((s) => s.slots.reduce((n, x) => n + x.prescription.sets, 0)),
    );
    expect(totalSets(afterMiss)).toBeLessThanOrEqual(standardMax);
    expect(afterMiss.isReturn).toBe(true);
  });

  it('rotation follows actual completion, not calendar', () => {
    const d = decideSession(coachInput({ today: FRI, history: [session(MON, { sessionKey: 'A' })] }));
    expect(d.kind === 'train' && d.sessionKey).toBe('B');
  });

  it('long break uses the re-entry variant (acceptance 8)', () => {
    const d = decideSession(coachInput({ today: MON, history: [session('2026-10-05')] }));
    expect(d.kind === 'train' && d.variant).toBe('reentry');
    expect(d.reasons).toContainEqual({ code: 'reentry_after_break', days: 28 });
  });

  it('uncertainty gives an introductory mission', () => {
    const d = decideSession(coachInput({ feeling: 'unsure' }));
    expect(d.kind === 'train' && d.variant).toBe('introductory');
    if (d.kind === 'train') expect(d.exercises.every((e) => e.prescription.setKind === 'familiarisation')).toBe(true);
  });

  it('respects excluded equipment and exercises in initial selection (acceptance 5)', () => {
    const d = decideSession(
      coachInput({
        constraints: {
          availableEquipment: ['dumbbells', 'bench', 'mat', 'seated_row_machine', 'chest_press_machine'],
          excludedExerciseIds: ['goblet_squat'],
          excludedEquipment: ['dumbbells'],
        },
      }),
    );
    expect(d.kind).toBe('train');
    if (d.kind !== 'train') return;
    for (const ex of d.exercises) {
      const e = DEV_CATALOGUE[ex.exerciseId];
      expect(ex.exerciseId).not.toBe('goblet_squat');
      expect(e.equipment).not.toContain('dumbbells');
      expect(e.equipment.every((q) => ['bench', 'mat', 'seated_row_machine', 'chest_press_machine'].includes(q))).toBe(true);
    }
  });

  it('explains instead of guessing when no valid exercise exists (acceptance 6)', () => {
    const d = decideSession(
      coachInput({
        constraints: { availableEquipment: ['mat'], excludedExerciseIds: [], excludedEquipment: [] },
      }),
    );
    // No squat or pull candidates are possible with only a mat.
    expect(d.kind).toBe('no_valid_session');
    if (d.kind === 'no_valid_session') {
      expect(d.reasons.some((r) => r.code === 'variant_unavailable')).toBe(true);
      expect(d.alternatives).toContain('rest');
    }
  });

  it('familiarity orders exercises but never overrides exclusions', () => {
    const d = decideSession(
      coachInput({
        familiarity: { seated_row_machine: 'comfortable', goblet_squat: 'comfortable' },
        constraints: { availableEquipment: ['leg_press_machine', 'dumbbells', 'bench', 'seated_row_machine', 'chest_press_machine', 'mat'], excludedExerciseIds: ['goblet_squat'], excludedEquipment: [] },
      }),
    );
    expect(d.kind).toBe('train');
    if (d.kind !== 'train') return;
    expect(d.exercises[0].exerciseId).toBe('seated_row_machine');
    expect(d.exercises.map((e) => e.exerciseId)).not.toContain('goblet_squat');
    expect(d.reasons).toContainEqual({ code: 'familiar_first', exerciseId: 'seated_row_machine' });
  });

  it('keeps the previously used movement for a slot stable', () => {
    const d = decideSession(
      coachInput({
        today: WED,
        history: [session(MON, { sessionKey: 'B', slotExercises: { 'A-squat': 'goblet_squat' } })],
      }),
    );
    expect(d.kind === 'train' && d.exercises.find((e) => e.slotId === 'A-squat')?.exerciseId).toBe('goblet_squat');
  });

  it('refuses unreviewed templates outside development', () => {
    const d = decideSession(coachInput({ environment: 'production' }));
    expect(d).toMatchObject({ kind: 'no_valid_session', reasons: [{ code: 'template_not_approved' }] });
  });

  it('paused programme is not a training day', () => {
    const d = decideSession(coachInput({ programme: { ...coachInput().programme, pause: { from: '2026-11-01', until: '2026-11-10' } } }));
    expect(d.kind === 'not_today' && d.day.kind).toBe('paused');
  });

  it('allows a user-chosen reschedule to a non-planned day', () => {
    const d = decideSession(coachInput({ today: THU, history: [session(MON)], rescheduledDates: [THU] }));
    expect(d.kind).toBe('train');
  });
});
