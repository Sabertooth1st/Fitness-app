/**
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { migrate } from '../../src/data/local/db';
import { LocalStore } from '../../src/data/local/store';
import { flushOutbox, syncStatus, type OpResult, type OutboxOp, type RemoteGateway } from '../../src/data/sync/syncEngine';
import { decideSession } from '../../src/domain/coach';
import { XP_RULES } from '../../src/domain/rules';
import { DEV_CATALOGUE } from '../../src/content/exercises.dev';
import { coachInput, MON } from '../domain/fixtures';
import { openNodeDb } from './nodeDb';

/** In-memory stand-in for apply_sync_operations: dedupes by op id and by entity id. */
class FakeServer implements RemoteGateway {
  seenOps = new Set<string>();
  entities = new Map<string, unknown>();
  failNextCalls = 0;
  /** Simulates the response being lost after the server applied the batch. */
  dropResponseOnce = false;
  completed = new Set<string>();

  async push(ops: OutboxOp[]) {
    if (this.failNextCalls > 0) {
      this.failNextCalls -= 1;
      throw new Error('network down');
    }
    const results = ops.map((op) => {
      if (this.seenOps.has(op.opId)) return { opId: op.opId, result: 'duplicate' as OpResult };
      const p = op.payload as { sessionId?: string; id?: string };
      if (op.entity === 'set_log' && p.sessionId && this.completed.has(p.sessionId)) {
        this.seenOps.add(op.opId);
        return { opId: op.opId, result: 'conflict_completed_elsewhere' as OpResult };
      }
      this.seenOps.add(op.opId);
      this.entities.set(`${op.entity}:${op.entityId}`, op.payload);
      return { opId: op.opId, result: 'applied' as OpResult };
    });
    if (this.dropResponseOnce) {
      this.dropResponseOnce = false;
      throw new Error('connection reset after commit');
    }
    return results;
  }

  count(entity: string) {
    return [...this.entities.keys()].filter((k) => k.startsWith(`${entity}:`)).length;
  }
}

async function seededStore() {
  const db = openNodeDb();
  await migrate(db);
  let clock = 1_000_000;
  const store = new LocalStore({ db, newId: randomUUID, now: () => new Date('2026-11-02T17:00:00Z') });
  const d = decideSession(coachInput());
  if (d.kind !== 'train') throw new Error('expected train');
  const id = await store.startSession({ decision: d, catalogue: DEV_CATALOGUE, localDate: MON, timezone: 'Europe/Zurich', checkInMethod: 'manual', rulesVersion: 't' });
  const s = (await store.getActiveSession())!;
  for (let i = 0; i < 3; i++) {
    await store.logSet({ sessionExerciseId: s.exercises[0].id, reps: 10, weight: { value: 40, unit: 'kg', basis: 'machine_stack' }, effort: null, kind: 'working' });
  }
  await store.award({ type: 'check_in', localDate: MON, sessionId: id, isTrainingDay: true }, { daysPerWeek: 3, rules: XP_RULES });
  return { db, store, sessionId: id, now: () => clock, advance: (ms: number) => (clock += ms) };
}

describe('sync engine', () => {
  it('guest data is uploaded once, even when the response is lost after commit (acceptance 12, 17)', async () => {
    const { db, now, advance } = await seededStore();
    const server = new FakeServer();
    server.dropResponseOnce = true;

    const first = await flushOutbox(db, server, now);
    expect(first.transportError).toMatch(/reset/);
    expect((await syncStatus(db)).pending).toBeGreaterThan(0);

    // Retry before backoff elapses does nothing; after it elapses, everything settles as duplicates/applied.
    expect((await flushOutbox(db, server, now)).sent).toBe(0);
    advance(10_000);
    const second = await flushOutbox(db, server, now);
    expect(second.transportError).toBeNull();
    expect(await syncStatus(db)).toEqual({ pending: 0, failed: 0, conflicts: 0 });

    expect(server.count('set_log')).toBe(3);
    expect(server.count('workout_session')).toBe(1);
    expect(server.count('xp_award')).toBe(1);

    // A third flush (e.g. app restart during migration) sends nothing new.
    expect((await flushOutbox(db, server, now)).sent).toBe(0);
  });

  it('backs off on network failure and keeps every operation', async () => {
    const { db, now, advance } = await seededStore();
    const server = new FakeServer();
    server.failNextCalls = 2;
    await flushOutbox(db, server, now);
    advance(5_000);
    await flushOutbox(db, server, now);
    const rows = await db.getAllAsync<{ attempts: number }>("SELECT attempts FROM outbox WHERE status = 'pending'", []);
    expect(rows.every((r) => r.attempts === 2)).toBe(true);
    advance(10_000);
    await flushOutbox(db, server, now);
    expect((await syncStatus(db)).pending).toBe(0);
  });

  it('surfaces a conflict when another device completed the session, keeping the local copy (acceptance 13)', async () => {
    const { db, store, sessionId, now } = await seededStore();
    const server = new FakeServer();
    await flushOutbox(db, server, now);
    server.completed.add(sessionId);
    const s = (await store.getActiveSession())!;
    await store.logSet({ sessionExerciseId: s.exercises[1].id, reps: 8, weight: null, effort: null, kind: 'working' });
    const r = await flushOutbox(db, server, now);
    expect(r.conflicts).toBe(1);
    expect((await syncStatus(db)).conflicts).toBe(1);
    // Local record is preserved for the user to resolve.
    expect((await store.getActiveSession())!.exercises[1].sets).toHaveLength(1);
  });
});
