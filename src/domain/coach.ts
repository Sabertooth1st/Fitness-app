/**
 * Comeback Coach: deterministic, explainable decisions that turn a barrier
 * into one clear, safe next action. Explicit rules only, no language model.
 */
import { checkEligibility, familiarityRank, type EligibilityContext, type IneligibleReason } from './eligibility';
import type { CoachRules } from './rules';
import { evaluateDay, lastAttended, nextSessionKey, nextTrainingDate, type DayStatus } from './schedule';
import type {
  AppEnvironment,
  CompletedSession,
  Constraints,
  Exercise,
  Familiarity,
  LocalDate,
  MovementPattern,
  ProgrammeTemplate,
  ReadinessFeeling,
  SafetyAnswer,
  SessionTemplate,
  SessionVariant,
  SlotPrescription,
  UserProgramme,
} from './types';

/** Reason codes map to reviewed copy in src/i18n. Never free text. */
export type CoachReason =
  | { code: 'standard_session' }
  | { code: 'shorter_for_time'; minutes: number }
  | { code: 'introductory_for_uncertainty' }
  | { code: 'reentry_after_break'; days: number | null }
  | { code: 'missed_not_doubled'; missed: number }
  | { code: 'familiar_first'; exerciseId: string }
  | { code: 'kept_previous_movement'; exerciseId: string }
  | { code: 'slot_dropped'; pattern: MovementPattern }
  | { code: 'variant_unavailable'; variant: SessionVariant; pattern: MovementPattern; cause: IneligibleReason }
  | { code: 'not_enough_time'; minutes: number }
  | { code: 'template_not_approved' }
  | { code: 'safety_stop' };

export interface PlannedExercise {
  slotId: string;
  exerciseId: string;
  pattern: MovementPattern;
  prescription: SlotPrescription;
}

export type CoachDecision =
  | { kind: 'safety_stop'; reasons: CoachReason[] }
  | { kind: 'not_today'; day: DayStatus; reasons: CoachReason[] }
  | {
      kind: 'train';
      variant: SessionVariant;
      sessionKey: string;
      templateId: string;
      templateVersion: number;
      estimatedMinutes: number;
      exercises: PlannedExercise[];
      reasons: CoachReason[];
      nextTrainingDateAfter: LocalDate | null;
      isReturn: boolean;
    }
  | { kind: 'no_valid_session'; reasons: CoachReason[]; alternatives: ('rest' | 'learn' | 'reschedule')[] };

export interface CoachInput {
  programme: UserProgramme;
  template: ProgrammeTemplate;
  catalogue: Record<string, Exercise>;
  history: CompletedSession[];
  today: LocalDate;
  rescheduledDates: LocalDate[];
  availableMinutes: number;
  feeling: ReadinessFeeling;
  safety: SafetyAnswer;
  constraints: Constraints;
  familiarity: Record<string, Familiarity>;
  environment: AppEnvironment;
  rules: CoachRules;
  disabledExerciseIds?: string[];
}

function findTemplate(template: ProgrammeTemplate, key: string, variant: SessionVariant): SessionTemplate | undefined {
  return template.sessions.find((s) => s.key === key && s.variant === variant);
}

/** Variant preference order for today's inputs, most suitable first. */
export function variantOrder(input: {
  feeling: ReadinessFeeling;
  longBreak: boolean;
  availableMinutes: number;
  standardMinutes: number;
}): { order: SessionVariant[]; reasons: CoachReason[] } {
  const reasons: CoachReason[] = [];
  let order: SessionVariant[];
  if (input.feeling === 'unsure') {
    order = ['introductory'];
    reasons.push({ code: 'introductory_for_uncertainty' });
  } else if (input.longBreak || input.feeling === 'returning') {
    order = ['reentry', 'introductory'];
  } else if (input.availableMinutes < input.standardMinutes) {
    order = ['short', 'introductory'];
    reasons.push({ code: 'shorter_for_time', minutes: input.availableMinutes });
  } else {
    order = ['standard', 'short', 'introductory'];
  }
  return { order, reasons };
}

export function selectExercises(
  session: SessionTemplate,
  ctx: EligibilityContext & {
    catalogue: Record<string, Exercise>;
    familiarity: Record<string, Familiarity>;
    previousSlotExercises: Record<string, string>;
  },
):
  | { ok: true; exercises: PlannedExercise[]; reasons: CoachReason[] }
  | { ok: false; pattern: MovementPattern; cause: IneligibleReason } {
  const reasons: CoachReason[] = [];
  const chosen: PlannedExercise[] = [];
  for (const slot of session.slots) {
    let firstCause: IneligibleReason = 'unknown_exercise';
    const eligible: string[] = [];
    for (const id of slot.candidates) {
      const r = checkEligibility(ctx.catalogue[id], ctx);
      if (r.ok) eligible.push(id);
      else if (eligible.length === 0 && firstCause === 'unknown_exercise') firstCause = r.reason;
    }
    if (eligible.length === 0) {
      if (slot.optional) {
        reasons.push({ code: 'slot_dropped', pattern: slot.pattern });
        continue;
      }
      return { ok: false, pattern: slot.pattern, cause: firstCause };
    }
    // Stability first: keep the movement used last time for this slot when still valid.
    const previous = ctx.previousSlotExercises[slot.slotId];
    let pick: string;
    if (previous && eligible.includes(previous)) {
      pick = previous;
    } else {
      // Familiarity orders eligible candidates; template order breaks ties.
      pick = [...eligible].sort(
        (a, b) => familiarityRank(ctx.familiarity, a) - familiarityRank(ctx.familiarity, b) || eligible.indexOf(a) - eligible.indexOf(b),
      )[0];
    }
    chosen.push({ slotId: slot.slotId, exerciseId: pick, pattern: slot.pattern, prescription: slot.prescription });
  }
  if (chosen.length === 0) return { ok: false, pattern: session.slots[0]?.pattern ?? 'trunk', cause: 'unknown_exercise' };

  // Start with the most familiar movement so the first action is clear. Stable sort keeps template order otherwise.
  const firstIdx = chosen.reduce(
    (best, ex, i) => (familiarityRank(ctx.familiarity, ex.exerciseId) < familiarityRank(ctx.familiarity, chosen[best].exerciseId) ? i : best),
    0,
  );
  if (firstIdx > 0) {
    const [first] = chosen.splice(firstIdx, 1);
    chosen.unshift(first);
  }
  if (ctx.familiarity[chosen[0].exerciseId] === 'comfortable') {
    reasons.push({ code: 'familiar_first', exerciseId: chosen[0].exerciseId });
  }
  for (const ex of chosen) {
    if (ctx.previousSlotExercises[ex.slotId] === ex.exerciseId) {
      reasons.push({ code: 'kept_previous_movement', exerciseId: ex.exerciseId });
      break;
    }
  }
  return { ok: true, exercises: chosen, reasons };
}

function previousSlotExercises(history: CompletedSession[]): Record<string, string> {
  const merged: Record<string, string> = {};
  const sorted = [...history].sort((a, b) => (a.localDate < b.localDate ? -1 : 1));
  for (const s of sorted) Object.assign(merged, s.slotExercises);
  return merged;
}

/**
 * Decide today's session. Safety outranks every habit and completion goal.
 */
export function decideSession(input: CoachInput): CoachDecision {
  if (input.safety === 'concern') {
    return { kind: 'safety_stop', reasons: [{ code: 'safety_stop' }] };
  }
  if (input.environment !== 'development' && input.template.reviewStatus !== 'approved') {
    return { kind: 'no_valid_session', reasons: [{ code: 'template_not_approved' }], alternatives: ['learn', 'rest'] };
  }

  const day = evaluateDay({
    programme: input.programme,
    history: input.history,
    today: input.today,
    rescheduledDates: input.rescheduledDates,
    rules: input.rules,
  });
  if (day.kind !== 'training') return { kind: 'not_today', day, reasons: [] };

  const sessionKey = nextSessionKey(input.template.rotation, input.history);
  const standard = findTemplate(input.template, sessionKey, 'standard');
  const { order, reasons } = variantOrder({
    feeling: input.feeling,
    longBreak: day.longBreak,
    availableMinutes: input.availableMinutes,
    standardMinutes: standard?.estimatedMinutes ?? Infinity,
  });
  if (day.longBreak || input.feeling === 'returning') {
    reasons.push({ code: 'reentry_after_break', days: day.daysSinceLast });
  }
  if (day.missedPlanned > 0) reasons.push({ code: 'missed_not_doubled', missed: day.missedPlanned });

  const ctx = {
    constraints: input.constraints,
    environment: input.environment,
    disabledExerciseIds: input.disabledExerciseIds,
    catalogue: input.catalogue,
    familiarity: input.familiarity,
    previousSlotExercises: previousSlotExercises(input.history),
  };

  const failures: CoachReason[] = [];
  for (const variant of order) {
    const session = findTemplate(input.template, sessionKey, variant);
    if (!session) continue;
    if (session.estimatedMinutes > input.availableMinutes) {
      failures.push({ code: 'not_enough_time', minutes: input.availableMinutes });
      continue;
    }
    const picked = selectExercises(session, ctx);
    if (!picked.ok) {
      failures.push({ code: 'variant_unavailable', variant, pattern: picked.pattern, cause: picked.cause });
      continue;
    }
    if (variant === 'standard') reasons.unshift({ code: 'standard_session' });
    return {
      kind: 'train',
      variant,
      sessionKey,
      templateId: input.template.id,
      templateVersion: input.template.version,
      estimatedMinutes: session.estimatedMinutes,
      exercises: picked.exercises,
      reasons: [...reasons, ...failures, ...picked.reasons],
      nextTrainingDateAfter: nextTrainingDate(
        input.programme,
        [...input.history, { sessionId: 'planned', localDate: input.today, sessionKey, variant, outcome: 'full', slotExercises: {} }],
        input.today,
        input.rules,
      ),
      isReturn: lastAttended(input.history) !== null && (day.missedPlanned > 0 || day.longBreak),
    };
  }
  // Never fall back to an excluded or unapproved exercise: explain the limit instead.
  return { kind: 'no_valid_session', reasons: failures, alternatives: ['learn', 'reschedule', 'rest'] };
}
