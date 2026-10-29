/**
 * Local-first repository. Every user edit is persisted immediately in a
 * serialised SQLite transaction together with its sync outbox operation, so a
 * logged set survives process death and is uploaded at most once.
 */
import type { CoachDecision, CoachReason } from '../../domain/coach';
import { classifyOutcome } from '../../domain/session';
import type {
  CompletedSession,
  Effort,
  Exercise,
  Familiarity,
  LocalDate,
  SessionOutcome,
  SetKind,
  UserProgramme,
} from '../../domain/types';
import type { Weight } from '../../domain/units';
import { evaluateAward, type LedgerEntry, type XpEvent } from '../../domain/xp';
import type { XpRules } from '../../domain/rules';
import { WriteQueue, type Db, type SqlValue } from './db';
import type {
  CheckInMethod,
  Consents,
  Exclusions,
  FamiliarityMap,
  GymProfile,
  Profile,
  ReminderPreferences,
  SessionExercise,
  SetLog,
  WorkoutSession,
} from './models';

export interface StoreDeps {
  db: Db;
  newId: () => string;
  now: () => Date;
}

export class ActiveSessionExistsError extends Error {
  constructor(public readonly sessionId: string) {
    super('An active workout already exists on this device.');
  }
}

type KvKey = 'profile' | 'programme' | 'exclusions' | 'device_id' | 'reminders' | 'consents' | 'account_owner';

interface SessionRow {
  id: string;
  local_date: string;
  timezone: string;
  status: WorkoutSession['status'];
  outcome: SessionOutcome | null;
  variant: WorkoutSession['variant'];
  session_key: string;
  template_id: string;
  template_version: number;
  reasons: string;
  check_in_method: CheckInMethod;
  check_in_at: string;
  started_at: string;
  finished_at: string | null;
  rest_until: number | null;
  current_index: number;
  is_return: number;
  device_id: string;
}

interface ExerciseRow {
  id: string;
  position: number;
  slot_id: string;
  exercise_id: string;
  status: SessionExercise['status'];
  replaced_by: string | null;
  substitution_reason: string | null;
  prescription: string;
  exercise_snapshot: string;
}

interface SetRow {
  id: string;
  workout_exercise_id: string;
  set_index: number;
  kind: SetKind;
  reps: number;
  weight_value: number | null;
  weight_unit: 'kg' | 'lb' | null;
  load_basis: Weight['basis'] | null;
  effort: Effort | null;
  completed_at: string;
}

export class LocalStore {
  private readonly queue: WriteQueue;
  constructor(private readonly deps: StoreDeps) {
    this.queue = new WriteQueue(deps.db);
  }

  private iso(): string {
    return this.deps.now().toISOString();
  }

  private async enqueue(db: Db, entity: string, entityId: string, op: 'upsert' | 'delete', payload: unknown): Promise<void> {
    await db.runAsync(
      'INSERT INTO outbox (op_id, entity, entity_id, op, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [this.deps.newId(), entity, entityId, op, JSON.stringify(payload), this.iso()],
    );
  }

  // ---------- key/value settings ----------

  async getKv<T>(key: KvKey): Promise<T | null> {
    const row = await this.deps.db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
    return row ? (JSON.parse(row.value) as T) : null;
  }

  async setKv(key: KvKey, value: unknown): Promise<void> {
    await this.queue.run((db) =>
      db.runAsync(
        'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
        [key, JSON.stringify(value), this.iso()],
      ),
    );
  }

  getProfile = () => this.getKv<Profile>('profile');
  setProfile = (p: Profile) => this.setKv('profile', p);
  getProgramme = () => this.getKv<UserProgramme>('programme');
  setProgramme = (p: UserProgramme) => this.setKv('programme', p);
  async getExclusions(): Promise<Exclusions> {
    return (await this.getKv<Exclusions>('exclusions')) ?? { excludedExerciseIds: [], excludedEquipment: [] };
  }
  setExclusions = (e: Exclusions) => this.setKv('exclusions', e);
  async getReminders(): Promise<ReminderPreferences> {
    return (await this.getKv<ReminderPreferences>('reminders')) ?? { enabled: false, hour: 17, minute: 30 };
  }
  setReminders = (r: ReminderPreferences) => this.setKv('reminders', r);
  async getConsents(): Promise<Consents> {
    return (await this.getKv<Consents>('consents')) ?? { cloudBackup: null, analytics: null };
  }
  setConsents = (c: Consents) => this.setKv('consents', c);

  async getDeviceId(): Promise<string> {
    const existing = await this.getKv<string>('device_id');
    if (existing) return existing;
    const id = this.deps.newId();
    await this.setKv('device_id', id);
    return id;
  }

  // ---------- gym ----------

  async getGym(): Promise<GymProfile | null> {
    const row = await this.deps.db.getFirstAsync<{ label: string; equipment: string; pin_lat: number | null; pin_lon: number | null }>(
      'SELECT label, equipment, pin_lat, pin_lon FROM gym_profile WHERE id = 1',
      [],
    );
    if (!row) return null;
    return {
      label: row.label,
      equipment: JSON.parse(row.equipment),
      pin: row.pin_lat !== null && row.pin_lon !== null ? { latitude: row.pin_lat, longitude: row.pin_lon } : null,
    };
  }

  async setGym(gym: GymProfile): Promise<void> {
    await this.queue.run(async (db) => {
      await db.runAsync(
        `INSERT INTO gym_profile (id, label, equipment, pin_lat, pin_lon, updated_at) VALUES (1, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET label = excluded.label, equipment = excluded.equipment,
           pin_lat = excluded.pin_lat, pin_lon = excluded.pin_lon, updated_at = excluded.updated_at`,
        [gym.label, JSON.stringify(gym.equipment), gym.pin?.latitude ?? null, gym.pin?.longitude ?? null, this.iso()],
      );
      // The pin is deliberately excluded from the synchronised payload.
      await this.enqueue(db, 'gym_profile', 'default', 'upsert', { label: gym.label, equipment: gym.equipment });
    });
  }

  // ---------- familiarity ----------

  async getFamiliarity(): Promise<FamiliarityMap> {
    const rows = await this.deps.db.getAllAsync<{ exercise_id: string; familiarity: Familiarity }>(
      'SELECT exercise_id, familiarity FROM exercise_confidence',
      [],
    );
    return Object.fromEntries(rows.map((r) => [r.exercise_id, r.familiarity]));
  }

  async setFamiliarity(exerciseId: string, familiarity: Familiarity): Promise<void> {
    await this.queue.run(async (db) => {
      await db.runAsync(
        `INSERT INTO exercise_confidence (exercise_id, familiarity, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(exercise_id) DO UPDATE SET familiarity = excluded.familiarity, updated_at = excluded.updated_at`,
        [exerciseId, familiarity, this.iso()],
      );
      await this.enqueue(db, 'exercise_confidence', exerciseId, 'upsert', { exerciseId, familiarity });
    });
  }

  // ---------- rescheduling ----------

  async getRescheduledDates(): Promise<LocalDate[]> {
    const rows = await this.deps.db.getAllAsync<{ local_date: string }>('SELECT local_date FROM rescheduled_dates', []);
    return rows.map((r) => r.local_date);
  }

  async rescheduleTo(date: LocalDate): Promise<void> {
    await this.queue.run((db) =>
      db.runAsync('INSERT OR IGNORE INTO rescheduled_dates (local_date, created_at) VALUES (?, ?)', [date, this.iso()]),
    );
  }

  // ---------- workouts ----------

  async startSession(input: {
    decision: Extract<CoachDecision, { kind: 'train' }>;
    catalogue: Record<string, Exercise>;
    localDate: LocalDate;
    timezone: string;
    checkInMethod: CheckInMethod;
    rulesVersion: string;
  }): Promise<string> {
    const deviceId = await this.getDeviceId();
    return this.queue.run(async (db) => {
      const active = await db.getFirstAsync<{ id: string }>("SELECT id FROM workout_sessions WHERE status = 'active'", []);
      if (active) throw new ActiveSessionExistsError(active.id);
      const id = this.deps.newId();
      const now = this.iso();
      const d = input.decision;
      await db.runAsync(
        `INSERT INTO workout_sessions (id, local_date, timezone, status, outcome, variant, session_key, template_id, template_version,
           rules_version, reasons, check_in_method, check_in_at, started_at, current_index, is_return, device_id, updated_at)
         VALUES (?, ?, ?, 'active', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [
          id,
          input.localDate,
          input.timezone,
          d.variant,
          d.sessionKey,
          d.templateId,
          d.templateVersion,
          input.rulesVersion,
          JSON.stringify(d.reasons),
          input.checkInMethod,
          now,
          now,
          d.isReturn ? 1 : 0,
          deviceId,
          now,
        ],
      );
      // Only method, session reference and time are recorded for check-in. No coordinates.
      await this.enqueue(db, 'workout_session', id, 'upsert', {
        id,
        localDate: input.localDate,
        variant: d.variant,
        sessionKey: d.sessionKey,
        checkInMethod: input.checkInMethod,
        checkInAt: now,
        status: 'active',
        deviceId,
      });
      for (const [position, ex] of d.exercises.entries()) {
        const exId = this.deps.newId();
        const snapshot = input.catalogue[ex.exerciseId];
        await db.runAsync(
          `INSERT INTO workout_exercises (id, session_id, position, slot_id, exercise_id, status, prescription, exercise_snapshot, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
          [exId, id, position, ex.slotId, ex.exerciseId, JSON.stringify(ex.prescription), JSON.stringify(snapshot), now],
        );
        await this.enqueue(db, 'workout_exercise', exId, 'upsert', {
          id: exId,
          sessionId: id,
          position,
          slotId: ex.slotId,
          exerciseId: ex.exerciseId,
          status: 'pending',
          prescription: ex.prescription,
          contentVersion: snapshot?.contentVersion ?? null,
        });
      }
      return id;
    });
  }

  /**
   * Record a safety stop chosen before any exercise started, so the day shows
   * as a calm rest day and pilot metrics can count safety stops honestly.
   */
  async recordSafetyStop(input: { localDate: LocalDate; timezone: string; checkInMethod: CheckInMethod; sessionKey: string; templateId: string; templateVersion: number; rulesVersion: string }): Promise<string> {
    const deviceId = await this.getDeviceId();
    return this.queue.run(async (db) => {
      const id = this.deps.newId();
      const now = this.iso();
      await db.runAsync(
        `INSERT INTO workout_sessions (id, local_date, timezone, status, outcome, variant, session_key, template_id, template_version,
           rules_version, reasons, check_in_method, check_in_at, started_at, finished_at, device_id, updated_at)
         VALUES (?, ?, ?, 'safety_stopped', 'safety_stop', 'standard', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, input.localDate, input.timezone, input.sessionKey, input.templateId, input.templateVersion, input.rulesVersion, JSON.stringify([{ code: 'safety_stop' }]), input.checkInMethod, now, now, now, deviceId, now],
      );
      await this.enqueue(db, 'workout_session', id, 'upsert', { id, localDate: input.localDate, status: 'safety_stopped', outcome: 'safety_stop', checkInMethod: input.checkInMethod, checkInAt: now });
      return id;
    });
  }

  async getActiveSession(): Promise<WorkoutSession | null> {
    const row = await this.deps.db.getFirstAsync<SessionRow>("SELECT * FROM workout_sessions WHERE status = 'active'", []);
    return row ? this.hydrate(row) : null;
  }

  async getSession(id: string): Promise<WorkoutSession | null> {
    const row = await this.deps.db.getFirstAsync<SessionRow>('SELECT * FROM workout_sessions WHERE id = ?', [id]);
    return row ? this.hydrate(row) : null;
  }

  private async hydrate(row: SessionRow): Promise<WorkoutSession> {
    const db = this.deps.db;
    const exRows = await db.getAllAsync<ExerciseRow>('SELECT * FROM workout_exercises WHERE session_id = ? ORDER BY position', [row.id]);
    const setRows = await db.getAllAsync<SetRow>(
      `SELECT s.* FROM set_logs s JOIN workout_exercises e ON e.id = s.workout_exercise_id WHERE e.session_id = ? ORDER BY s.set_index`,
      [row.id],
    );
    const exercises: SessionExercise[] = exRows.map((e) => ({
      id: e.id,
      position: e.position,
      slotId: e.slot_id,
      exerciseId: e.exercise_id,
      status: e.status,
      replacedBy: e.replaced_by,
      substitutionReason: e.substitution_reason,
      prescription: JSON.parse(e.prescription),
      snapshot: JSON.parse(e.exercise_snapshot),
      sets: setRows.filter((s) => s.workout_exercise_id === e.id).map(toSetLog),
    }));
    return {
      id: row.id,
      localDate: row.local_date,
      timezone: row.timezone,
      status: row.status,
      outcome: row.outcome,
      variant: row.variant,
      sessionKey: row.session_key,
      templateId: row.template_id,
      templateVersion: row.template_version,
      reasons: JSON.parse(row.reasons) as CoachReason[],
      checkInMethod: row.check_in_method,
      checkInAt: row.check_in_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      restUntil: row.rest_until,
      currentIndex: row.current_index,
      isReturn: row.is_return === 1,
      deviceId: row.device_id,
      exercises,
    };
  }

  private async assertActive(db: Db, sessionExerciseId: string): Promise<ExerciseRow & { session_id: string; status_s: string }> {
    const row = await db.getFirstAsync<ExerciseRow & { session_id: string; status_s: string }>(
      `SELECT e.*, s.status AS status_s FROM workout_exercises e JOIN workout_sessions s ON s.id = e.session_id WHERE e.id = ?`,
      [sessionExerciseId],
    );
    if (!row) throw new Error('Unknown workout exercise');
    if (row.status_s !== 'active') throw new Error('Workout is no longer active; completed records are not modified.');
    return row;
  }

  async logSet(input: {
    sessionExerciseId: string;
    reps: number;
    weight: Weight | null;
    effort: Effort | null;
    kind: SetKind;
  }): Promise<SetLog> {
    return this.queue.run(async (db) => {
      const ex = await this.assertActive(db, input.sessionExerciseId);
      const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM set_logs WHERE workout_exercise_id = ?', [ex.id]);
      const setIndex = count?.n ?? 0;
      const id = this.deps.newId();
      const now = this.iso();
      await db.runAsync(
        `INSERT INTO set_logs (id, workout_exercise_id, set_index, kind, reps, weight_value, weight_unit, load_basis, effort, completed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, ex.id, setIndex, input.kind, input.reps, input.weight?.value ?? null, input.weight?.unit ?? null, input.weight?.basis ?? null, input.effort, now, now],
      );
      const prescribed = (JSON.parse(ex.prescription) as { sets: number }).sets;
      const status = setIndex + 1 >= prescribed ? 'done' : 'in_progress';
      await db.runAsync('UPDATE workout_exercises SET status = ?, updated_at = ? WHERE id = ?', [status, now, ex.id]);
      await db.runAsync('UPDATE workout_sessions SET updated_at = ? WHERE id = ?', [now, ex.session_id]);
      const log: SetLog = { id, setIndex, kind: input.kind, reps: input.reps, weight: input.weight, effort: input.effort, completedAt: now };
      await this.enqueue(db, 'set_log', id, 'upsert', { ...log, sessionId: ex.session_id, workoutExerciseId: ex.id, exerciseId: ex.exercise_id });
      return log;
    });
  }

  async updateSet(setId: string, patch: { reps?: number; weight?: Weight | null; effort?: Effort | null }): Promise<void> {
    await this.queue.run(async (db) => {
      const row = await db.getFirstAsync<SetRow>('SELECT * FROM set_logs WHERE id = ?', [setId]);
      if (!row) throw new Error('Unknown set');
      await this.assertActive(db, row.workout_exercise_id);
      const weight = patch.weight === undefined ? toSetLog(row).weight : patch.weight;
      const reps = patch.reps ?? row.reps;
      const effort = patch.effort === undefined ? row.effort : patch.effort;
      await db.runAsync(
        'UPDATE set_logs SET reps = ?, weight_value = ?, weight_unit = ?, load_basis = ?, effort = ?, updated_at = ? WHERE id = ?',
        [reps, weight?.value ?? null, weight?.unit ?? null, weight?.basis ?? null, effort, this.iso(), setId],
      );
      await this.enqueue(db, 'set_log', setId, 'upsert', { id: setId, reps, weight, effort });
    });
  }

  async setRestUntil(sessionId: string, deadline: number | null): Promise<void> {
    await this.queue.run((db) =>
      db.runAsync("UPDATE workout_sessions SET rest_until = ?, updated_at = ? WHERE id = ? AND status = 'active'", [deadline, this.iso(), sessionId]),
    );
  }

  async setCurrentIndex(sessionId: string, index: number): Promise<void> {
    await this.queue.run((db) =>
      db.runAsync("UPDATE workout_sessions SET current_index = ?, updated_at = ? WHERE id = ? AND status = 'active'", [index, this.iso(), sessionId]),
    );
  }

  /**
   * Replace one exercise. Logged sets stay attached to the original record and
   * nothing else in the workout changes.
   */
  async substituteExercise(sessionExerciseId: string, replacement: Exercise, reason: string): Promise<string> {
    return this.queue.run(async (db) => {
      const ex = await this.assertActive(db, sessionExerciseId);
      const logged = (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM set_logs WHERE workout_exercise_id = ?', [ex.id]))?.n ?? 0;
      const prescription = JSON.parse(ex.prescription) as { sets: number };
      const newId = this.deps.newId();
      const now = this.iso();
      await db.runAsync('UPDATE workout_exercises SET position = position + 1 WHERE session_id = ? AND position > ?', [ex.session_id, ex.position]);
      await db.runAsync(
        `INSERT INTO workout_exercises (id, session_id, position, slot_id, exercise_id, status, substitution_reason, prescription, exercise_snapshot, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
        [
          newId,
          ex.session_id,
          ex.position + 1,
          ex.slot_id,
          replacement.id,
          reason,
          JSON.stringify({ ...prescription, sets: Math.max(1, prescription.sets - logged) }),
          JSON.stringify(replacement),
          now,
        ],
      );
      await db.runAsync("UPDATE workout_exercises SET status = 'replaced', replaced_by = ?, updated_at = ? WHERE id = ?", [newId, now, ex.id]);
      await this.enqueue(db, 'workout_exercise', newId, 'upsert', {
        id: newId,
        sessionId: ex.session_id,
        position: ex.position + 1,
        slotId: ex.slot_id,
        exerciseId: replacement.id,
        status: 'pending',
        reason,
        prescription: { ...prescription, sets: Math.max(1, prescription.sets - logged) },
        contentVersion: replacement.contentVersion,
      });
      await this.enqueue(db, 'workout_exercise', ex.id, 'upsert', { id: ex.id, status: 'replaced', replacedBy: newId, reason });
      return newId;
    });
  }

  async skipExercise(sessionExerciseId: string): Promise<void> {
    await this.queue.run(async (db) => {
      const ex = await this.assertActive(db, sessionExerciseId);
      if (ex.status === 'done') return;
      await db.runAsync("UPDATE workout_exercises SET status = 'skipped', updated_at = ? WHERE id = ?", [this.iso(), ex.id]);
    });
  }

  /** Finish the active session. A safety stop is recorded as such, without penalty. */
  async finishSession(sessionId: string, opts: { safetyStop?: boolean } = {}): Promise<WorkoutSession> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Unknown session');
    if (session.status !== 'active') return session; // idempotent
    const outcome: SessionOutcome = opts.safetyStop
      ? 'safety_stop'
      : classifyOutcome(
          session.variant,
          session.exercises.map((e) => ({ status: e.status, prescription: e.prescription, loggedSets: e.sets.length })),
        );
    const status: WorkoutSession['status'] = opts.safetyStop ? 'safety_stopped' : outcome === 'abandoned' ? 'abandoned' : 'completed';
    await this.queue.run(async (db) => {
      const now = this.iso();
      await db.runAsync(
        "UPDATE workout_sessions SET status = ?, outcome = ?, finished_at = ?, rest_until = NULL, updated_at = ? WHERE id = ? AND status = 'active'",
        [status, outcome, now, now, sessionId],
      );
      await this.enqueue(db, 'workout_session', sessionId, 'upsert', { id: sessionId, status, outcome, finishedAt: now });
    });
    return (await this.getSession(sessionId))!;
  }

  async listHistory(): Promise<CompletedSession[]> {
    const rows = await this.deps.db.getAllAsync<{ id: string; local_date: string; session_key: string; variant: CompletedSession['variant']; outcome: SessionOutcome }>(
      "SELECT id, local_date, session_key, variant, outcome FROM workout_sessions WHERE status != 'active' AND outcome IS NOT NULL ORDER BY started_at",
      [],
    );
    const slots = await this.deps.db.getAllAsync<{ session_id: string; slot_id: string; exercise_id: string }>(
      "SELECT session_id, slot_id, exercise_id FROM workout_exercises WHERE status IN ('done','in_progress') ORDER BY position",
      [],
    );
    return rows.map((r) => ({
      sessionId: r.id,
      localDate: r.local_date,
      sessionKey: r.session_key,
      variant: r.variant,
      outcome: r.outcome,
      slotExercises: Object.fromEntries(slots.filter((s) => s.session_id === r.id).map((s) => [s.slot_id, s.exercise_id])),
    }));
  }

  async listSessions(limit = 50): Promise<WorkoutSession[]> {
    const rows = await this.deps.db.getAllAsync<SessionRow>(
      "SELECT * FROM workout_sessions WHERE status != 'active' ORDER BY started_at DESC LIMIT ?",
      [limit],
    );
    return Promise.all(rows.map((r) => this.hydrate(r)));
  }

  /** Working sets from the most recent finished session that included this exercise. */
  async lastWorkingSets(exerciseId: string): Promise<SetLog[]> {
    const row = await this.deps.db.getFirstAsync<{ id: string }>(
      `SELECT e.id FROM workout_exercises e JOIN workout_sessions s ON s.id = e.session_id
       WHERE e.exercise_id = ? AND s.status = 'completed'
         AND EXISTS (SELECT 1 FROM set_logs l WHERE l.workout_exercise_id = e.id AND l.kind = 'working')
       ORDER BY s.started_at DESC LIMIT 1`,
      [exerciseId],
    );
    if (!row) return [];
    const sets = await this.deps.db.getAllAsync<SetRow>(
      "SELECT * FROM set_logs WHERE workout_exercise_id = ? AND kind = 'working' ORDER BY set_index",
      [row.id],
    );
    return sets.map(toSetLog);
  }

  // ---------- XP and milestones ----------

  async getLedger(): Promise<LedgerEntry[]> {
    const rows = await this.deps.db.getAllAsync<{
      award_key: string;
      kind: LedgerEntry['kind'];
      amount: number;
      local_date: string;
      session_id: string | null;
      rules_version: string;
    }>('SELECT * FROM xp_ledger ORDER BY created_at', []);
    return rows.map((r) => ({
      awardKey: r.award_key,
      kind: r.kind,
      amount: r.amount,
      localDate: r.local_date,
      sessionId: r.session_id,
      rulesVersion: r.rules_version,
    }));
  }

  /** Evaluate and insert inside one transaction; the unique key makes replays harmless. */
  async award(event: XpEvent, ctx: { daysPerWeek: number; rules: XpRules }): Promise<LedgerEntry | null> {
    return this.queue.run(async (db) => {
      const ledger = await this.getLedger();
      const entry = evaluateAward(event, ledger, ctx);
      if (!entry) return null;
      const res = await db.runAsync(
        'INSERT OR IGNORE INTO xp_ledger (award_key, kind, amount, local_date, session_id, rules_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [entry.awardKey, entry.kind, entry.amount, entry.localDate, entry.sessionId, entry.rulesVersion, this.iso()],
      );
      if (res.changes === 0) return null;
      await this.enqueue(db, 'xp_award', entry.awardKey, 'upsert', entry);
      return entry;
    });
  }

  async recordLessonView(exerciseId: string, localDate: LocalDate): Promise<void> {
    await this.queue.run((db) =>
      db.runAsync('INSERT OR IGNORE INTO lesson_views (exercise_id, local_date) VALUES (?, ?)', [exerciseId, localDate]),
    );
  }

  async getMilestones(): Promise<{ key: string; localDate: string }[]> {
    const rows = await this.deps.db.getAllAsync<{ key: string; local_date: string }>('SELECT key, local_date FROM milestones ORDER BY earned_at', []);
    return rows.map((r) => ({ key: r.key, localDate: r.local_date }));
  }

  async earnMilestone(key: string, localDate: LocalDate): Promise<boolean> {
    return this.queue.run(async (db) => {
      const res = await db.runAsync('INSERT OR IGNORE INTO milestones (key, local_date, earned_at) VALUES (?, ?, ?)', [key, localDate, this.iso()]);
      if (res.changes > 0) await this.enqueue(db, 'milestone', key, 'upsert', { key, localDate });
      return res.changes > 0;
    });
  }

  // ---------- export ----------

  async exportAll(): Promise<Record<string, unknown>> {
    const db = this.deps.db;
    const all = (sql: string, params: SqlValue[] = []) => db.getAllAsync<Record<string, unknown>>(sql, params);
    const gym = await this.getGym();
    return {
      exportedAt: this.iso(),
      format: 'arrive-export-v1',
      profile: await this.getProfile(),
      programme: await this.getProgramme(),
      exclusions: await this.getExclusions(),
      gym: gym ? { label: gym.label, equipment: gym.equipment, pinStoredOnDevice: gym.pin !== null } : null,
      familiarity: await this.getFamiliarity(),
      sessions: await all('SELECT * FROM workout_sessions ORDER BY started_at'),
      exercises: await all('SELECT id, session_id, position, slot_id, exercise_id, status, replaced_by, substitution_reason, prescription FROM workout_exercises'),
      sets: await all('SELECT * FROM set_logs'),
      xp: await this.getLedger(),
      milestones: await this.getMilestones(),
    };
  }
}

function toSetLog(r: SetRow): SetLog {
  return {
    id: r.id,
    setIndex: r.set_index,
    kind: r.kind,
    reps: r.reps,
    weight: r.weight_value !== null && r.weight_unit && r.load_basis ? { value: r.weight_value, unit: r.weight_unit, basis: r.load_basis } : null,
    effort: r.effort,
    completedAt: r.completed_at,
  };
}
