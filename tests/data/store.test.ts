/**
 * @jest-environment node
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { migrate } from '../../src/data/local/db';
import { ActiveSessionExistsError, LocalStore } from '../../src/data/local/store';
import { decideSession } from '../../src/domain/coach';
import { XP_RULES } from '../../src/domain/rules';
import { DEV_CATALOGUE } from '../../src/content/exercises.dev';
import { coachInput, MON } from '../domain/fixtures';
import { openNodeDb } from './nodeDb';

function trainDecision() {
  const d = decideSession(coachInput());
  if (d.kind !== 'train') throw new Error('expected train');
  return d;
}

async function setup(path = ':memory:') {
  const db = openNodeDb(path);
  await migrate(db);
  const store = new LocalStore({ db, newId: randomUUID, now: () => new Date('2026-11-02T17:00:00Z') });
  return { db, store };
}

const startArgs = { catalogue: DEV_CATALOGUE, localDate: MON, timezone: 'Europe/Zurich', checkInMethod: 'manual' as const, rulesVersion: 'test' };

describe('LocalStore', () => {
  it('preserves a logged set and the active workout across app termination (acceptance 10)', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'arrive-')), 'test.db');
    const first = await setup(path);
    const id = await first.store.startSession({ decision: trainDecision(), ...startArgs });
    const active = (await first.store.getActiveSession())!;
    await first.store.logSet({
      sessionExerciseId: active.exercises[0].id,
      reps: 10,
      weight: { value: 40, unit: 'kg', basis: 'machine_stack' },
      effort: 'about_right',
      kind: 'working',
    });
    await first.store.setRestUntil(id, 1_800_000_000_000);
    first.db.close(); // simulate process death

    const second = await setup(path);
    const resumed = (await second.store.getActiveSession())!;
    expect(resumed.id).toBe(id);
    expect(resumed.restUntil).toBe(1_800_000_000_000);
    expect(resumed.exercises[0].sets).toEqual([
      expect.objectContaining({ reps: 10, weight: { value: 40, unit: 'kg', basis: 'machine_stack' }, effort: 'about_right' }),
    ]);
    second.db.close();
  });

  it('allows only one active workout per device', async () => {
    const { store } = await setup();
    await store.startSession({ decision: trainDecision(), ...startArgs });
    await expect(store.startSession({ decision: trainDecision(), ...startArgs })).rejects.toBeInstanceOf(ActiveSessionExistsError);
  });

  it('substitution keeps completed sets and only changes the affected exercise', async () => {
    const { store } = await setup();
    await store.startSession({ decision: trainDecision(), ...startArgs });
    let s = (await store.getActiveSession())!;
    const target = s.exercises[1];
    await store.logSet({ sessionExerciseId: target.id, reps: 8, weight: null, effort: 'hard', kind: 'working' });
    const before = s.exercises.map((e) => e.exerciseId);
    await store.substituteExercise(target.id, DEV_CATALOGUE.incline_push_up, 'too_hard');
    s = (await store.getActiveSession())!;
    const replaced = s.exercises.find((e) => e.id === target.id)!;
    expect(replaced.status).toBe('replaced');
    expect(replaced.sets).toHaveLength(1);
    const after = s.exercises.filter((e) => e.status !== 'replaced').map((e) => e.exerciseId);
    expect(after).toEqual(before.map((id, i) => (i === 1 ? 'incline_push_up' : id)));
    expect(s.exercises.find((e) => e.exerciseId === 'incline_push_up')!.prescription.sets).toBe(target.prescription.sets - 1);
  });

  it('never modifies a finished workout', async () => {
    const { store } = await setup();
    const id = await store.startSession({ decision: trainDecision(), ...startArgs });
    const s = (await store.getActiveSession())!;
    await store.logSet({ sessionExerciseId: s.exercises[0].id, reps: 10, weight: null, effort: null, kind: 'working' });
    const done = await store.finishSession(id);
    expect(done.outcome).toBe('partial');
    await expect(store.logSet({ sessionExerciseId: s.exercises[0].id, reps: 5, weight: null, effort: null, kind: 'working' })).rejects.toThrow(
      /no longer active/,
    );
    // Finishing twice is idempotent.
    expect((await store.finishSession(id)).finishedAt).toBe(done.finishedAt);
  });

  it('records a safety stop distinctly', async () => {
    const { store } = await setup();
    const id = await store.startSession({ decision: trainDecision(), ...startArgs });
    const done = await store.finishSession(id, { safetyStop: true });
    expect(done).toMatchObject({ status: 'safety_stopped', outcome: 'safety_stop' });
    expect((await store.listHistory())[0].outcome).toBe('safety_stop');
  });

  it('XP awards are deduplicated in storage (acceptance 12)', async () => {
    const { store } = await setup();
    const ev = { type: 'check_in' as const, localDate: MON, sessionId: 's1', isTrainingDay: true };
    const results = await Promise.all([store.award(ev, { daysPerWeek: 3, rules: XP_RULES }), store.award(ev, { daysPerWeek: 3, rules: XP_RULES })]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await store.getLedger()).toHaveLength(1);
  });

  it('every write has exactly one outbox operation with a unique id', async () => {
    const { store, db } = await setup();
    await store.startSession({ decision: trainDecision(), ...startArgs });
    const s = (await store.getActiveSession())!;
    await store.logSet({ sessionExerciseId: s.exercises[0].id, reps: 10, weight: null, effort: null, kind: 'working' });
    const ops = await db.getAllAsync<{ op_id: string; entity: string; payload: string }>('SELECT op_id, entity, payload FROM outbox', []);
    const s0 = (await store.getActiveSession())!;
    expect(ops.map((o) => o.entity)).toEqual(['workout_session', ...s0.exercises.map(() => 'workout_exercise'), 'set_log']);
    expect(new Set(ops.map((o) => o.op_id)).size).toBe(ops.length);
    // The check-in record never contains coordinates.
    expect(ops[0].payload).not.toMatch(/lat|lon/i);
  });

  it('keeps the gym pin out of the sync payload', async () => {
    const { store, db } = await setup();
    await store.setGym({ label: 'My gym', equipment: ['dumbbells'], pin: { latitude: 47.1, longitude: 8.5 } });
    expect((await store.getGym())!.pin).toEqual({ latitude: 47.1, longitude: 8.5 });
    const op = await db.getFirstAsync<{ payload: string }>("SELECT payload FROM outbox WHERE entity = 'gym_profile'", []);
    expect(JSON.parse(op!.payload)).toEqual({ label: 'My gym', equipment: ['dumbbells'] });
  });

  it('export contains the gym without coordinates', async () => {
    const { store } = await setup();
    await store.setGym({ label: 'My gym', equipment: ['dumbbells'], pin: { latitude: 47.1, longitude: 8.5 } });
    const data = await store.exportAll();
    expect(JSON.stringify(data)).not.toContain('47.1');
  });
});
