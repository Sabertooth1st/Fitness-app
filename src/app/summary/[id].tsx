import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Body, Button, Card, Choice, Heading, Pill, Screen, Title } from '../../components/ui';
import { COACH_RULES } from '../../domain/rules';
import { nextTrainingDate } from '../../domain/schedule';
import type { Familiarity } from '../../domain/types';
import type { WorkoutSession } from '../../data/local/models';
import { useApp } from '../../features/app/AppState';
import { useT } from '../../i18n';
import { formatDate } from '../../i18n/format';

const LEVELS: Familiarity[] = ['new', 'reminder', 'comfortable'];

export default function Summary() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store, snapshot, refresh } = useApp();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  useEffect(() => {
    if (id) void store.getSession(id).then(setSession);
  }, [id, store]);
  if (!session || !snapshot?.programme) return null;

  const xp = snapshot.ledger.filter((e) => e.sessionId === session.id).reduce((n, e) => n + e.amount, 0);
  const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const next = nextTrainingDate(snapshot.programme, snapshot.history, session.localDate, COACH_RULES);
  const welcomeBack = snapshot.milestones.some((m) => m.key === 'welcome_back' && m.localDate === session.localDate);
  const practised = [...new Map(session.exercises.filter((e) => e.sets.length > 0).map((e) => [e.exerciseId, e])).values()];

  return (
    <Screen>
      <Title>{t('summary.title')}</Title>
      <Card tone="accent">
        <Heading>{t('summary.outcome', { outcome: t.dyn(`outcome.${session.outcome ?? 'partial'}`) })}</Heading>
        <Body>{t('summary.sets', { n: sets })}</Body>
        <Pill label={xp > 0 ? t('summary.xp', { n: xp }) : t('summary.xpNone')} />
        {welcomeBack && <Body>★ {t('summary.welcomeBack')}</Body>}
        {next && <Body>{t('summary.nextVisit', { date: formatDate(next, t.locale) })}</Body>}
      </Card>
      {practised.length > 0 && (
        <>
          <Heading>{t('summary.confidenceTitle')}</Heading>
          <Body muted>{t('familiarity.note')}</Body>
          {practised.map((e) => (
            <Card key={e.exerciseId}>
              <Heading>{e.snapshot.name.en}</Heading>
              {LEVELS.map((f) => (
                <Choice
                  key={f}
                  label={t.dyn(`familiarity.${f}`)}
                  selected={(snapshot.familiarity[e.exerciseId] ?? 'new') === f}
                  onPress={async () => {
                    await store.setFamiliarity(e.exerciseId, f);
                    if (f === 'comfortable') await store.earnMilestone('first_setup_comfortable', session.localDate);
                    await refresh();
                  }}
                />
              ))}
            </Card>
          ))}
        </>
      )}
      <Button testID="summary-done" label={t('summary.done')} onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}
