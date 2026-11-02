import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { FlameIcon } from '../../components/icons';
import { Body, Button, Card, Choice, Display, Eyebrow, Heading, Row, Screen, Small, Stat } from '../../components/ui';
import { COACH_RULES } from '../../domain/rules';
import { nextTrainingDate } from '../../domain/schedule';
import type { Familiarity } from '../../domain/types';
import type { WorkoutSession } from '../../data/local/models';
import { useApp } from '../../features/app/AppState';
import { useT } from '../../i18n';
import { formatDate } from '../../i18n/format';
import { fonts, spacing } from '../../theme/tokens';

const LEVELS: Familiarity[] = ['new', 'reminder', 'comfortable'];

export default function Summary() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store, snapshot, refresh, palette: p } = useApp();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  useEffect(() => {
    if (id) void store.getSession(id).then(setSession);
  }, [id, store]);
  if (!session || !snapshot?.programme) return null;

  const xp = snapshot.ledger.filter((e) => e.sessionId === session.id).reduce((n, e) => n + e.amount, 0);
  const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const exercisesDone = session.exercises.filter((e) => e.sets.length > 0).length;
  const next = nextTrainingDate(snapshot.programme, snapshot.history, session.localDate, COACH_RULES);
  const badges = snapshot.milestones.filter((m) => m.localDate === session.localDate);
  const practised = [...new Map(session.exercises.filter((e) => e.sets.length > 0).map((e) => [e.exerciseId, e])).values()];

  return (
    <Screen>
      <View style={{ gap: spacing.sm, paddingTop: spacing.md }}>
        {session.hardDay && (
          <Row gap={spacing.sm}>
            <FlameIcon color={p.accentInk} />
            <Eyebrow tone="accent">{t('hardDay.title')}</Eyebrow>
          </Row>
        )}
        <Display tone="accent">{session.hardDay ? t('summary.titleHardDay') : t('summary.title')}</Display>
        <Body>{t('summary.outcome', { outcome: t.dyn(`outcome.${session.outcome ?? 'partial'}`) })}</Body>
      </View>
      <Row gap={spacing.sm}>
        <Stat value={sets} label={t('summary.statSets')} />
        <Stat value={exercisesDone} label={t('summary.statExercises')} />
        <Stat value={xp > 0 ? `+${xp}` : '0'} label={t('summary.statXp')} />
      </Row>
      {xp === 0 && <Small>{t('summary.xpNone')}</Small>}
      {badges.length > 0 && (
        <Card tone="accent">
          <Eyebrow tone="accent">{t('progress.milestones')}</Eyebrow>
          {badges.map((b) => (
            <Text key={b.key} style={{ fontFamily: fonts.displaySemi, fontSize: 20, color: p.text, textTransform: 'uppercase' }}>
              ★ {t.dyn(`milestone.${b.key}`)}
            </Text>
          ))}
        </Card>
      )}
      {next && <Eyebrow tone="accent">{t('summary.nextVisit', { date: formatDate(next, t.locale) })}</Eyebrow>}
      {practised.length > 0 && (
        <>
          <Heading>{t('summary.confidenceTitle')}</Heading>
          <Small>{t('familiarity.note')}</Small>
          {practised.map((e) => (
            <Card key={e.exerciseId}>
              <Body bold>{e.snapshot.name.en}</Body>
              {LEVELS.map((f) => (
                <Choice
                  compact
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
      <Button testID="summary-done" size="large" label={t('summary.done')} onPress={() => router.dismissTo('/(tabs)')} />
    </Screen>
  );
}
