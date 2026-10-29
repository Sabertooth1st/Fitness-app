/**
 * Minimal database interface implemented by expo-sqlite's SQLiteDatabase in
 * the app and by node:sqlite in tests. Repositories depend only on this.
 */
export type SqlValue = string | number | null;

export interface Db {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/**
 * expo-sqlite's withTransactionAsync is not exclusive: other async queries can
 * interleave. All writes go through this queue so each logical write is one
 * serialised transaction.
 */
export class WriteQueue {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly db: Db) {}

  run<T>(task: (db: Db) => Promise<T>): Promise<T> {
    const next = this.tail.then(async () => {
      let result!: T;
      await this.db.withTransactionAsync(async () => {
        result = await task(this.db);
      });
      return result;
    });
    this.tail = next.catch(() => undefined);
    return next;
  }
}

const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS gym_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    label TEXT NOT NULL,
    equipment TEXT NOT NULL,
    pin_lat REAL,
    pin_lon REAL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS exercise_confidence (
    exercise_id TEXT PRIMARY KEY NOT NULL,
    familiarity TEXT NOT NULL CHECK (familiarity IN ('new','reminder','comfortable')),
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workout_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    local_date TEXT NOT NULL,
    timezone TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active','completed','safety_stopped','abandoned')),
    outcome TEXT CHECK (outcome IS NULL OR outcome IN ('full','partial','introductory','safety_stop','abandoned')),
    variant TEXT NOT NULL,
    session_key TEXT NOT NULL,
    template_id TEXT NOT NULL,
    template_version INTEGER NOT NULL,
    rules_version TEXT NOT NULL,
    reasons TEXT NOT NULL,
    check_in_method TEXT NOT NULL CHECK (check_in_method IN ('manual','location_assisted')),
    check_in_at TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    rest_until INTEGER,
    current_index INTEGER NOT NULL DEFAULT 0,
    is_return INTEGER NOT NULL DEFAULT 0,
    device_id TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS workout_sessions_one_active ON workout_sessions(status) WHERE status = 'active';
  CREATE INDEX IF NOT EXISTS workout_sessions_date ON workout_sessions(local_date);
  CREATE TABLE IF NOT EXISTS workout_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    slot_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','in_progress','done','replaced','skipped')),
    replaced_by TEXT,
    substitution_reason TEXT,
    prescription TEXT NOT NULL,
    exercise_snapshot TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS workout_exercises_session ON workout_exercises(session_id, position);
  CREATE TABLE IF NOT EXISTS set_logs (
    id TEXT PRIMARY KEY NOT NULL,
    workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    set_index INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('warmup','working','familiarisation')),
    reps INTEGER NOT NULL CHECK (reps >= 0 AND reps <= 200),
    weight_value REAL CHECK (weight_value IS NULL OR (weight_value >= 0 AND weight_value <= 1000)),
    weight_unit TEXT CHECK (weight_unit IS NULL OR weight_unit IN ('kg','lb')),
    load_basis TEXT,
    effort TEXT CHECK (effort IS NULL OR effort IN ('easy','about_right','hard')),
    completed_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (workout_exercise_id, set_index)
  );
  CREATE TABLE IF NOT EXISTS xp_ledger (
    award_key TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    amount INTEGER NOT NULL,
    local_date TEXT NOT NULL,
    session_id TEXT,
    rules_version TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS milestones (
    key TEXT PRIMARY KEY NOT NULL,
    local_date TEXT NOT NULL,
    earned_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS lesson_views (
    exercise_id TEXT NOT NULL,
    local_date TEXT NOT NULL,
    PRIMARY KEY (exercise_id, local_date)
  );
  CREATE TABLE IF NOT EXISTS rescheduled_dates (
    local_date TEXT PRIMARY KEY NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS outbox (
    op_id TEXT PRIMARY KEY NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    op TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed'))
  );
  CREATE INDEX IF NOT EXISTS outbox_pending ON outbox(status, next_attempt_at);
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: Db): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

/** Remove every local user record (used by sign-out isolation and deletion). */
export async function wipeLocalData(db: Db): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const table of [
      'set_logs',
      'workout_exercises',
      'workout_sessions',
      'xp_ledger',
      'milestones',
      'lesson_views',
      'rescheduled_dates',
      'exercise_confidence',
      'gym_profile',
      'outbox',
      'kv',
    ]) {
      await db.execAsync(`DELETE FROM ${table};`);
    }
  });
}
