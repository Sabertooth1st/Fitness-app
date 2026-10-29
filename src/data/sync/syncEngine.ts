/**
 * Pushes the local outbox to the server. Operations carry stable op IDs and
 * the server applies each at most once, so retries after a dropped
 * connection can never duplicate sets, sessions or XP.
 *
 * Nothing is sent unless the user has an account AND consented to cloud
 * backup; guest data stays on the device until then. Because the outbox holds
 * every change since the first launch, guest-to-account migration is simply
 * the first flush, and it can be retried safely.
 */
import type { Db } from '../local/db';

export interface OutboxOp {
  opId: string;
  entity: string;
  entityId: string;
  op: string;
  payload: unknown;
  attempts: number;
}

export type OpResult =
  | 'applied'
  | 'duplicate'
  | 'conflict_completed_elsewhere'
  | 'rejected_not_owner'
  | 'rejected_invalid_amount'
  | 'rejected_weekly_cap'
  | 'rejected_unknown_entity'
  | 'retry_parent_missing';

export interface RemoteGateway {
  /** Throws on transport failure; returns per-operation results otherwise. */
  push(ops: OutboxOp[]): Promise<{ opId: string; result: OpResult }[]>;
}

export interface SyncOptions {
  batchSize: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_SYNC_OPTIONS: SyncOptions = { batchSize: 50, maxAttempts: 10, baseDelayMs: 5_000, maxDelayMs: 3_600_000 };

export function backoff(attempts: number, o: SyncOptions): number {
  return Math.min(o.maxDelayMs, o.baseDelayMs * 2 ** Math.max(0, attempts - 1));
}

export interface SyncReport {
  sent: number;
  applied: number;
  conflicts: number;
  rejected: number;
  retrying: number;
  transportError: string | null;
}

export async function flushOutbox(db: Db, gateway: RemoteGateway, now: () => number, o: SyncOptions = DEFAULT_SYNC_OPTIONS): Promise<SyncReport> {
  const report: SyncReport = { sent: 0, applied: 0, conflicts: 0, rejected: 0, retrying: 0, transportError: null };
  for (;;) {
    const rows = await db.getAllAsync<{ op_id: string; entity: string; entity_id: string; op: string; payload: string; attempts: number }>(
      "SELECT op_id, entity, entity_id, op, payload, attempts FROM outbox WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY created_at, rowid LIMIT ?",
      [now(), o.batchSize],
    );
    if (rows.length === 0) return report;
    const ops: OutboxOp[] = rows.map((r) => ({ opId: r.op_id, entity: r.entity, entityId: r.entity_id, op: r.op, payload: JSON.parse(r.payload), attempts: r.attempts }));

    let results: { opId: string; result: OpResult }[];
    try {
      results = await gateway.push(ops);
    } catch (e) {
      report.transportError = e instanceof Error ? e.message : String(e);
      await db.withTransactionAsync(async () => {
        for (const op of ops) await reschedule(db, op, now, o, report.transportError);
      });
      report.retrying += ops.length;
      return report;
    }
    report.sent += ops.length;
    const byId = new Map(results.map((r) => [r.opId, r.result]));
    let progressed = false;
    await db.withTransactionAsync(async () => {
      for (const op of ops) {
        const result = byId.get(op.opId);
        if (result === 'applied' || result === 'duplicate') {
          await db.runAsync("UPDATE outbox SET status = 'done', last_error = NULL WHERE op_id = ?", [op.opId]);
          report.applied += 1;
          progressed = true;
        } else if (result === 'conflict_completed_elsewhere') {
          // Keep the local record untouched; mark the op so the UI can surface the conflict.
          await db.runAsync("UPDATE outbox SET status = 'failed', last_error = ? WHERE op_id = ?", [result, op.opId]);
          report.conflicts += 1;
          progressed = true;
        } else if (result && result.startsWith('rejected_')) {
          await db.runAsync("UPDATE outbox SET status = 'failed', last_error = ? WHERE op_id = ?", [result, op.opId]);
          report.rejected += 1;
          progressed = true;
        } else {
          await reschedule(db, op, now, o, result ?? 'missing_result');
          report.retrying += 1;
        }
      }
    });
    if (!progressed) return report;
  }
}

async function reschedule(db: Db, op: OutboxOp, now: () => number, o: SyncOptions, error: string | null): Promise<void> {
  const attempts = op.attempts + 1;
  if (attempts >= o.maxAttempts) {
    await db.runAsync("UPDATE outbox SET status = 'failed', attempts = ?, last_error = ? WHERE op_id = ?", [attempts, error, op.opId]);
  } else {
    await db.runAsync('UPDATE outbox SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE op_id = ?', [attempts, now() + backoff(attempts, o), error, op.opId]);
  }
}

/** Bound the outbox: completed operations older than the retention window are removed. */
export async function pruneOutbox(db: Db, olderThanIso: string): Promise<void> {
  await db.runAsync("DELETE FROM outbox WHERE status = 'done' AND created_at < ?", [olderThanIso]);
}

export async function syncStatus(db: Db): Promise<{ pending: number; failed: number; conflicts: number }> {
  const row = await db.getFirstAsync<{ pending: number; failed: number; conflicts: number }>(
    `SELECT
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
       SUM(CASE WHEN last_error = 'conflict_completed_elsewhere' THEN 1 ELSE 0 END) AS conflicts
     FROM outbox`,
    [],
  );
  return { pending: row?.pending ?? 0, failed: row?.failed ?? 0, conflicts: row?.conflicts ?? 0 };
}
