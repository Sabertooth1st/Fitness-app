import { DEV_CATALOGUE } from '../../src/content/exercises.dev';
import { FULL_BODY_TEMPLATE_DEV } from '../../src/content/templates.dev';
import type { CoachInput } from '../../src/domain/coach';
import { COACH_RULES } from '../../src/domain/rules';
import { ALL_EQUIPMENT, type CompletedSession, type LocalDate } from '../../src/domain/types';

// 2026-11-02 is a Monday.
export const MON = '2026-11-02';
export const TUE = '2026-11-03';
export const WED = '2026-11-04';
export const THU = '2026-11-05';
export const FRI = '2026-11-06';

export function session(localDate: LocalDate, overrides: Partial<CompletedSession> = {}): CompletedSession {
  return { sessionId: `s-${localDate}`, localDate, sessionKey: 'A', variant: 'standard', outcome: 'full', slotExercises: {}, ...overrides };
}

export function coachInput(overrides: Partial<CoachInput> = {}): CoachInput {
  return {
    programme: {
      templateId: FULL_BODY_TEMPLATE_DEV.id,
      templateVersion: 1,
      daysPerWeek: 3,
      preferredWeekdays: [1, 3, 5],
      startDate: '2026-10-01',
      sessionMinutes: 45,
      pause: null,
    },
    template: FULL_BODY_TEMPLATE_DEV,
    catalogue: DEV_CATALOGUE,
    history: [],
    today: MON,
    rescheduledDates: [],
    availableMinutes: 45,
    feeling: 'comfortable',
    safety: 'ok',
    constraints: { availableEquipment: [...ALL_EQUIPMENT], excludedExerciseIds: [], excludedEquipment: [] },
    familiarity: {},
    environment: 'development',
    rules: COACH_RULES,
    ...overrides,
  };
}
