import * as Crypto from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import type { CoachInput } from '../../domain/coach';
import { toLocalDate } from '../../domain/dates';
import { COACH_RULES } from '../../domain/rules';
import type { CompletedSession, LocalDate, ReadinessFeeling, UserProgramme } from '../../domain/types';
import type { LedgerEntry } from '../../domain/xp';
import { DEV_CATALOGUE } from '../../content/exercises.dev';
import { TEMPLATES } from '../../content/templates.dev';
import { env } from '../../config/env';
import { DISABLED_EXERCISE_IDS } from '../../config/featureSwitches';
import type { Db } from '../../data/local/db';
import type { Exclusions, FamiliarityMap, GymProfile, Profile, WorkoutSession } from '../../data/local/models';
import { LocalStore } from '../../data/local/store';
import { LocaleContext } from '../../i18n';
import { dark, light, type Palette } from '../../theme/tokens';

export interface Snapshot {
  profile: Profile | null;
  programme: UserProgramme | null;
  exclusions: Exclusions;
  gym: GymProfile | null;
  familiarity: FamiliarityMap;
  history: CompletedSession[];
  ledger: LedgerEntry[];
  active: WorkoutSession | null;
  rescheduledDates: LocalDate[];
  milestones: { key: string; localDate: string }[];
}

interface AppContextValue {
  store: LocalStore;
  snapshot: Snapshot | null;
  refresh: () => Promise<void>;
  palette: Palette;
  timezone: string;
  today: () => LocalDate;
}

const AppContext = createContext<AppContextValue | null>(null);

export const catalogue = DEV_CATALOGUE;

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const store = useMemo(
    () => new LocalStore({ db: db as unknown as Db, newId: () => Crypto.randomUUID(), now: () => new Date() }),
    [db],
  );
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const scheme = useColorScheme();

  const refresh = useCallback(async () => {
    const [profile, programme, exclusions, gym, familiarity, history, ledger, active, rescheduledDates, milestones] = await Promise.all([
      store.getProfile(),
      store.getProgramme(),
      store.getExclusions(),
      store.getGym(),
      store.getFamiliarity(),
      store.listHistory(),
      store.getLedger(),
      store.getActiveSession(),
      store.getRescheduledDates(),
      store.getMilestones(),
    ]);
    setSnapshot({ profile, programme, exclusions, gym, familiarity, history, ledger, active, rescheduledDates, milestones });
  }, [store]);

  useEffect(() => {
    // Initial load from SQLite; state is set after the async reads complete.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const themePref = snapshot?.profile?.theme ?? 'system';
  const palette = themePref === 'dark' || (themePref === 'system' && scheme === 'dark') ? dark : light;
  const timezone = deviceTimezone();

  const value = useMemo<AppContextValue>(
    () => ({ store, snapshot, refresh, palette, timezone, today: () => toLocalDate(new Date(), timezone) }),
    [store, snapshot, refresh, palette, timezone],
  );

  return (
    <AppContext.Provider value={value}>
      <LocaleContext.Provider value={snapshot?.profile?.locale ?? 'en'}>{children}</LocaleContext.Provider>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export function usePalette(): Palette {
  return useApp().palette;
}

/** Assemble Comeback Coach inputs from the local snapshot. */
export function coachInputFrom(
  snap: Snapshot,
  today: LocalDate,
  overrides: { availableMinutes?: number; feeling?: ReadinessFeeling; safety?: 'ok' | 'concern' } = {},
): CoachInput | null {
  if (!snap.programme) return null;
  const template = TEMPLATES[snap.programme.templateId];
  if (!template) return null;
  return {
    programme: snap.programme,
    template,
    catalogue,
    history: snap.history,
    today,
    rescheduledDates: snap.rescheduledDates,
    availableMinutes: overrides.availableMinutes ?? snap.programme.sessionMinutes,
    feeling: overrides.feeling ?? 'comfortable',
    safety: overrides.safety ?? 'ok',
    constraints: {
      availableEquipment: snap.gym?.equipment ?? [],
      excludedExerciseIds: snap.exclusions.excludedExerciseIds,
      excludedEquipment: snap.exclusions.excludedEquipment,
    },
    familiarity: snap.familiarity,
    environment: env.appEnv,
    rules: COACH_RULES,
    disabledExerciseIds: DISABLED_EXERCISE_IDS,
  };
}
