/**
 * DRAFT Swiss High German locale — NOT REVIEWED.
 *
 * Machine-assisted draft for structure only. It must be reviewed by a native
 * speaker before release, and safety copy must additionally be approved by a
 * qualified professional. Missing keys fall back to English. This locale is
 * only selectable in development builds (see src/config/env.ts).
 */
import type { Dictionary } from './en';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

export const deCHDraft: DeepPartial<Dictionary> = {
  common: { continue: 'Weiter', back: 'Zurück', cancel: 'Abbrechen', done: 'Fertig', save: 'Speichern', close: 'Schliessen' },
  tabs: { today: 'Heute', learn: 'Lernen', progress: 'Fortschritt', profile: 'Profil' },
  today: { greeting: 'Heute', checkIn: 'Ich bin im Fitnessstudio', preview: 'Plan ansehen' },
};
