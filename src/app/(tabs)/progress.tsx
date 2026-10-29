import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Body, Card, Heading, Pill, Row, Screen, Title } from '../../components/ui';
import { completedWeeks, summariseWeek } from '../../domain/adherence';
import { XP_RULES } from '../../domain/rules';
import { levelFor, totalXp } from '../../domain/xp';
import type { WorkoutSession } from '../../data/local/models';
import { useApp } from '../../features/app/AppState';
import { useT } from '../../i18n';
import { formatDate } from '../../i18n/format';
import { radius, spacing } from '../../theme/tokens';

export default function Progress() {
  const t = useT();
  const { snapshot, store, refresh, today, palette } = useApp();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  useEffect(() => {
    void store.listSessions(30).then(setSessions);
  }, [store, snapshot]);
  if (!snapshot?.programme) return null;

  const week = summariseWeek(snapshot.programme, snapshot.history, today());
  const xp = totalXp(snapshot.ledger);
  const level = levelFor(xp, XP_RULES);
  const comfortable = Object.values(snapshot.familiarity).filter((f) => f === 'comfortable').length;
  const progressToNext = level.nextAt ? (xp - XP_RULES.levels[level.index].minXp) / (level.nextAt - XP_RULES.levels[level.index].minXp) : 1;

  return (
    <Screen>
      <Title>{t('progress.title')}</Title>
      <Card tone="accent">
        <Heading>{t('progress.thisWeek', { n: week.attended, target: week.target })}</Heading>
        {week.pausedDays > 0 && <Body muted>{t('progress.pausedDays', { n: week.pausedDays })}</Body>}
        <Body>{t('progress.completedWeeks', { n: completedWeeks(snapshot.programme, snapshot.history) })}</Body>
      </Card>
      <Card>
        <Body muted>{t('progress.level')}</Body>
        <Heading>{t.dyn(`level.${level.key}`)}</Heading>
        <Body>{t('progress.xpTotal', { n: xp })}</Body>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progressToNext * 100) }}
          style={{ height: 10, borderRadius: radius.pill, backgroundColor: palette.surfaceMuted, overflow: 'hidden' }}
        >
          <View style={{ width: `${Math.round(progressToNext * 100)}%`, height: '100%', backgroundColor: palette.accent }} />
        </View>
        <Body muted>
          {level.nextAt
            ? t('progress.nextLevel', { n: level.nextAt - xp, level: t.dyn(`level.${XP_RULES.levels[level.index + 1].key}`) })
            : t('progress.maxLevel')}
        </Body>
        <Body muted>{t('progress.levelNote')}</Body>
      </Card>
      <Card>
        <Heading>{t('progress.confidence')}</Heading>
        <Body>{t('progress.confidenceCount', { n: comfortable })}</Body>
        <Body muted>{t('familiarity.note')}</Body>
      </Card>
      {snapshot.milestones.length > 0 && (
        <Card>
          <Heading>{t('progress.milestones')}</Heading>
          {snapshot.milestones.map((m) => (
            <Body key={m.key}>★ {t.dyn(`milestone.${m.key}`)} · {formatDate(m.localDate, t.locale)}</Body>
          ))}
        </Card>
      )}
      <Heading>{t('progress.history')}</Heading>
      {sessions.length === 0 && <Body muted>{t('progress.historyEmpty')}</Body>}
      {sessions.map((s) => (
        <Card key={s.id}>
          <Body muted>{formatDate(s.localDate, t.locale)}</Body>
          <Row gap={spacing.sm} wrap>
            <Pill label={t.dyn(`outcome.${s.outcome ?? 'partial'}`)} tone={s.outcome === 'full' ? 'accent' : 'muted'} />
            <Pill label={t.dyn(`variant.${s.variant}`)} />
            <Pill label={s.checkInMethod === 'manual' ? t('checkIn.manualNote') : t('checkIn.location')} />
          </Row>
          {s.exercises
            .filter((e) => e.sets.length > 0)
            .map((e) => (
              <Body key={e.id}>
                {e.snapshot.name.en}: {e.sets.length} × {e.sets.map((x) => x.reps).join('/')}
              </Body>
            ))}
        </Card>
      ))}
    </Screen>
  );
}
