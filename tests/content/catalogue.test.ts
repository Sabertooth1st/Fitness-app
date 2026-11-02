import { DEV_CATALOGUE, DEV_EXERCISES } from '../../src/content/exercises.dev';
import { TEMPLATES } from '../../src/content/templates.dev';
import { ALL_EQUIPMENT } from '../../src/domain/types';

describe('exercise catalogue integrity', () => {
  it('has a broad library with unique ids', () => {
    expect(DEV_EXERCISES.length).toBeGreaterThanOrEqual(90);
    expect(new Set(DEV_EXERCISES.map((e) => e.id)).size).toBe(DEV_EXERCISES.length);
  });

  it.each(DEV_EXERCISES.map((e) => [e.id, e] as const))('%s is complete and its relations are valid', (_id, e) => {
    expect(e.name.en.length).toBeGreaterThan(2);
    expect(e.setup.en.length).toBeGreaterThan(0);
    expect(e.cues.en.length).toBeGreaterThan(0);
    expect(e.mistakes.en.length).toBeGreaterThan(0);
    expect(e.primaryMuscles.length).toBeGreaterThan(0);
    expect(e.reviewStatus).toBe('not_reviewed');
    for (const q of e.equipment) expect(ALL_EQUIPMENT).toContain(q);
    for (const rel of [...e.alternatives, ...e.regressions, ...e.progressions]) {
      const target = DEV_CATALOGUE[rel];
      expect(target).toBeDefined();
      expect(rel).not.toBe(e.id);
      // Substitutes must train the same movement pattern.
      if (e.alternatives.includes(rel) || e.regressions.includes(rel)) expect(target.pattern).toBe(e.pattern);
    }
  });

  it('every template candidate exists and matches its slot pattern', () => {
    for (const t of Object.values(TEMPLATES)) {
      for (const s of t.sessions) {
        for (const slot of s.slots) {
          for (const c of slot.candidates) {
            expect(DEV_CATALOGUE[c]).toBeDefined();
            expect(DEV_CATALOGUE[c].pattern).toBe(slot.pattern);
          }
        }
      }
    }
  });
});
