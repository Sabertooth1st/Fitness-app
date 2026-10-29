/**
 * DEVELOPMENT PROGRAMME TEMPLATES — NOT REVIEWED.
 *
 * Provisional two- and three-day full-body templates for development only.
 * Sets, repetitions, rest times and session variants must be approved by a
 * qualified exercise professional before production use. No reviewer has been
 * recorded; do not add one without real evidence.
 */
import type { MovementPattern, ProgrammeTemplate, SessionTemplate, SlotPrescription, TemplateSlot } from '../domain/types';

const working = (sets: number, repsMin = 8, repsMax = 12, restSeconds = 90): SlotPrescription => ({
  sets,
  repsMin,
  repsMax,
  restSeconds,
  setKind: 'working',
});
const familiarise: SlotPrescription = { sets: 2, repsMin: 8, repsMax: 10, restSeconds: 90, setKind: 'familiarisation' };

const CANDIDATES: Record<MovementPattern, string[]> = {
  squat: ['leg_press', 'goblet_squat', 'box_squat', 'sit_to_stand'],
  hinge: ['db_romanian_deadlift', 'glute_bridge', 'hip_hinge_drill'],
  horizontal_push: ['machine_chest_press', 'db_bench_press', 'incline_push_up', 'wall_push_up'],
  vertical_push: ['machine_shoulder_press', 'seated_db_shoulder_press'],
  horizontal_pull: ['seated_row_machine', 'one_arm_db_row'],
  vertical_pull: ['lat_pulldown', 'kneeling_cable_pulldown'],
  knee_flexion: ['seated_leg_curl'],
  knee_extension: ['leg_extension'],
  trunk: ['dead_bug', 'bird_dog', 'pallof_press'],
};

function slot(slotId: string, pattern: MovementPattern, prescription: SlotPrescription, optional = false): TemplateSlot {
  return { slotId, pattern, candidates: CANDIDATES[pattern], prescription, optional };
}

function variants(key: 'A' | 'B'): SessionTemplate[] {
  const squat = slot(`${key}-squat`, 'squat', working(3));
  const hinge = slot(`${key}-hinge`, 'hinge', working(2), true);
  const push = key === 'A' ? slot('A-hpush', 'horizontal_push', working(3)) : slot('B-vpush', 'vertical_push', working(2), true);
  const push2 = key === 'B' ? slot('B-hpush', 'horizontal_push', working(2)) : null;
  const pull = key === 'A' ? slot('A-hpull', 'horizontal_pull', working(3)) : slot('B-vpull', 'vertical_pull', working(3));
  const legAccessory = key === 'A' ? slot('A-curl', 'knee_flexion', working(2, 10, 15, 60), true) : slot('B-ext', 'knee_extension', working(2, 10, 15, 60), true);
  const trunk = slot(`${key}-trunk`, 'trunk', working(2, 6, 10, 60), true);

  const standardSlots = [squat, push2 ?? push, pull, hinge, ...(push2 ? [push] : []), legAccessory, trunk];
  const withPrescription = (s: TemplateSlot, p: SlotPrescription): TemplateSlot => ({ ...s, prescription: p });

  return [
    { key, variant: 'standard', estimatedMinutes: 45, slots: standardSlots },
    {
      key,
      variant: 'short',
      estimatedMinutes: 20,
      slots: [withPrescription(squat, working(2)), withPrescription(push2 ?? push, working(2)), withPrescription(pull, working(2))],
    },
    {
      key,
      variant: 'introductory',
      estimatedMinutes: 15,
      slots: [withPrescription(squat, familiarise), withPrescription(pull, familiarise)],
    },
    {
      key,
      variant: 'reentry',
      estimatedMinutes: 30,
      slots: [
        withPrescription(squat, working(2, 10, 12)),
        withPrescription(push2 ?? push, working(2, 10, 12)),
        withPrescription(pull, working(2, 10, 12)),
        withPrescription(trunk, working(1, 6, 10, 60)),
      ],
    },
  ];
}

export const FULL_BODY_TEMPLATE_DEV: ProgrammeTemplate = {
  id: 'full-body-beginner',
  version: 1,
  reviewStatus: 'not_reviewed',
  reviewNote: 'Provisional development template. Requires review by a qualified exercise professional.',
  daysPerWeek: 3,
  rotation: ['A', 'B'],
  sessions: [...variants('A'), ...variants('B')],
};

export const TEMPLATES: Record<string, ProgrammeTemplate> = {
  [FULL_BODY_TEMPLATE_DEV.id]: FULL_BODY_TEMPLATE_DEV,
};
