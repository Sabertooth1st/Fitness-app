/**
 * Core domain types. Everything in src/domain is pure TypeScript: no React,
 * no Expo, no I/O. Functions take an explicit clock/date so they are
 * reproducible in tests.
 */

/** Calendar date in the user's local timezone, formatted YYYY-MM-DD. */
export type LocalDate = string;

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Experience = 'new' | 'some' | 'returning';
export type Goal = 'general_strength' | 'confidence' | 'everyday_health';
export type WeightUnit = 'kg' | 'lb';

export type Equipment =
  | 'leg_press_machine'
  | 'chest_press_machine'
  | 'shoulder_press_machine'
  | 'lat_pulldown_machine'
  | 'seated_row_machine'
  | 'leg_curl_machine'
  | 'leg_extension_machine'
  | 'cable_station'
  | 'dumbbells'
  | 'bench'
  | 'mat';

export const ALL_EQUIPMENT: readonly Equipment[] = [
  'leg_press_machine',
  'chest_press_machine',
  'shoulder_press_machine',
  'lat_pulldown_machine',
  'seated_row_machine',
  'leg_curl_machine',
  'leg_extension_machine',
  'cable_station',
  'dumbbells',
  'bench',
  'mat',
];

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'knee_flexion'
  | 'knee_extension'
  | 'trunk';

export type Muscle =
  | 'chest'
  | 'front_shoulders'
  | 'side_shoulders'
  | 'rear_shoulders'
  | 'triceps'
  | 'biceps'
  | 'forearms'
  | 'upper_back'
  | 'lats'
  | 'lower_back'
  | 'abdominals'
  | 'obliques'
  | 'glutes'
  | 'quadriceps'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

/** User-reported familiarity with a movement. Not an assessment of technique. */
export type Familiarity = 'new' | 'reminder' | 'comfortable';

/** How the user describes today. The app never claims to sense emotions. */
export type ReadinessFeeling = 'comfortable' | 'unsure' | 'returning';

/** Outcome of the readiness safety question. 'concern' always wins. */
export type SafetyAnswer = 'ok' | 'concern';

export type SessionVariant = 'standard' | 'short' | 'introductory' | 'reentry';

/** Load convention for a logged weight, so dumbbells are never doubled by accident. */
export type LoadBasis = 'total' | 'per_hand' | 'machine_stack';

export type SetKind = 'warmup' | 'working' | 'familiarisation';

/** Plain-language effort answer: "Could you comfortably do a few more repetitions?" */
export type Effort = 'easy' | 'about_right' | 'hard';

export type ReviewStatus = 'not_reviewed' | 'approved' | 'rejected';

export type AppEnvironment = 'development' | 'staging' | 'production';

export type LocalizedText = { en: string } & Partial<Record<'de-CH', string>>;
export type LocalizedList = { en: string[] } & Partial<Record<'de-CH', string[]>>;

export type ExerciseMedia =
  | { kind: 'none' }
  | {
      kind: 'licensed';
      assetId: string;
      mediaType: 'video/mp4' | 'image/png' | 'image/webp' | 'image/gif';
      stillAssetId?: string;
    };

export interface Exercise {
  id: string;
  provider: { name: string; externalId: string } | null;
  name: LocalizedText;
  aliases: string[];
  equipment: Equipment[];
  /** How a logged weight for this exercise should be interpreted. */
  loadBasis: LoadBasis | 'bodyweight';
  pattern: MovementPattern;
  skill: 1 | 2 | 3;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  setup: LocalizedList;
  cues: LocalizedList;
  mistakes: LocalizedList;
  stopGuidance: LocalizedText;
  media: ExerciseMedia;
  /** Approved same-pattern alternatives, in preference order. */
  alternatives: string[];
  /** Easier approved versions, used when a movement feels too hard. */
  regressions: string[];
  progressions: string[];
  contentVersion: number;
  source: string;
  licence: string;
  reviewStatus: ReviewStatus;
}

export interface SlotPrescription {
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  setKind: SetKind;
}

export interface TemplateSlot {
  slotId: string;
  pattern: MovementPattern;
  /** Candidate exercises in reviewed preference order. */
  candidates: string[];
  prescription: SlotPrescription;
  /** An optional slot may be dropped if no candidate is valid. */
  optional: boolean;
}

export interface SessionTemplate {
  key: string;
  variant: SessionVariant;
  estimatedMinutes: number;
  slots: TemplateSlot[];
}

export interface ProgrammeTemplate {
  id: string;
  version: number;
  reviewStatus: ReviewStatus;
  reviewNote: string;
  daysPerWeek: 2 | 3;
  /** Session keys rotated in order, e.g. ['A', 'B']. */
  rotation: string[];
  sessions: SessionTemplate[];
}

export interface UserProgramme {
  templateId: string;
  templateVersion: number;
  daysPerWeek: 2 | 3;
  preferredWeekdays: Weekday[];
  startDate: LocalDate;
  sessionMinutes: number;
  pause: { from: LocalDate; until: LocalDate | null } | null;
}

export type SessionOutcome = 'full' | 'partial' | 'introductory' | 'safety_stop' | 'abandoned';

export interface CompletedSession {
  sessionId: string;
  localDate: LocalDate;
  sessionKey: string;
  variant: SessionVariant;
  outcome: SessionOutcome;
  /** Exercise chosen for each template slot, used to keep movements stable. */
  slotExercises: Record<string, string>;
}

export interface Constraints {
  availableEquipment: Equipment[];
  excludedExerciseIds: string[];
  excludedEquipment: Equipment[];
  /** Equipment occupied right now; only affects the active session. */
  occupiedEquipment?: Equipment[];
}
