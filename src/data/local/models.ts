import type { CoachReason } from '../../domain/coach';
import type {
  Effort,
  Equipment,
  Exercise,
  Experience,
  Familiarity,
  Goal,
  LocalDate,
  SessionOutcome,
  SessionVariant,
  SetKind,
  SlotPrescription,
  WeightUnit,
} from '../../domain/types';
import type { Weight } from '../../domain/units';

export type LocaleCode = 'en' | 'de-CH';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Profile {
  adultConfirmed: true;
  goal: Goal;
  experience: Experience;
  units: WeightUnit;
  locale: LocaleCode;
  theme: ThemePreference;
  /** 'system' follows the OS reduce-motion setting. */
  reducedMotion: 'system' | 'on';
  createdAt: string;
}

export interface Exclusions {
  excludedExerciseIds: string[];
  excludedEquipment: Equipment[];
}

export interface GymProfile {
  label: string;
  equipment: Equipment[];
  /** Stays on the device. Never uploaded, never in analytics. */
  pin: { latitude: number; longitude: number } | null;
}

export interface ReminderPreferences {
  enabled: boolean;
  hour: number;
  minute: number;
}

export interface Consents {
  cloudBackup: { granted: boolean; version: string; at: string } | null;
  analytics: { granted: boolean; version: string; at: string } | null;
}

export type CheckInMethod = 'manual' | 'location_assisted';

export interface SetLog {
  id: string;
  setIndex: number;
  kind: SetKind;
  reps: number;
  weight: Weight | null;
  effort: Effort | null;
  completedAt: string;
}

export interface SessionExercise {
  id: string;
  position: number;
  slotId: string;
  exerciseId: string;
  status: 'pending' | 'in_progress' | 'done' | 'replaced' | 'skipped';
  replacedBy: string | null;
  substitutionReason: string | null;
  prescription: SlotPrescription;
  /** Content as shown at the time, so later catalogue updates never rewrite history. */
  snapshot: Exercise;
  sets: SetLog[];
}

export interface WorkoutSession {
  id: string;
  localDate: LocalDate;
  timezone: string;
  status: 'active' | 'completed' | 'safety_stopped' | 'abandoned';
  outcome: SessionOutcome | null;
  variant: SessionVariant;
  sessionKey: string;
  templateId: string;
  templateVersion: number;
  reasons: CoachReason[];
  checkInMethod: CheckInMethod;
  checkInAt: string;
  startedAt: string;
  finishedAt: string | null;
  restUntil: number | null;
  currentIndex: number;
  isReturn: boolean;
  deviceId: string;
  exercises: SessionExercise[];
}

export type FamiliarityMap = Record<string, Familiarity>;
