import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Body, Card, Eyebrow, Heading, Pill, Row, Screen, Segments, Small, Stat, Title } from '../../components/ui';
import { completedWeeks, summariseWeek } from '../../domain/adherence';
import { hardDayWins, weeksInARow } from '../../domain/motivation';
import { countsAsAttendance } from '../../domain/schedule';
import { XP_RULES } from '../../domain/rules';
import { levelFor, totalXp } from '../../domain/xp';
import type { WorkoutSession } from '../../data/local/models';
import { useApp } from '../../features/app/AppState';
import { useT } from '../../i18n';
import { formatDate } from '../../i18n/format';
import { spacing } from '../../theme/tokens';

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
      <Segments done={Math.min(week.attended, week.target)} target={week.target} label={t('progress.thisWeek', { n: week.attended, target: week.target })} />
      {week.pausedDays > 0 && <Small>{t('progress.pausedDays', { n: week.pausedDays })}</Small>}
      <Row gap={spacing.sm}>
        <Stat value={snapshot.history.filter(countsAsAttendance).length} label={t('motivation.sessionsDone')} />
        <Stat value={weeksInARow(snapshot.programme, snapshot.history, today())} label={t('motivation.weeksInARow')} />
        <Stat value={hardDayWins(snapshot.history)} label={t('motivation.hardDayCount')} />
      </Row>
      <Small>{t('progress.completedWeeks', { n: completedWeeks(snapshot.programme, snapshot.history) })}</Small>
      <Card>
        <Eyebrow tone="accent">{t('progress.level')}</Eyebrow>
        <Heading>{t.dyn(`level.${level.key}`)}</Heading>
        <Body>{t('progress.xpTotal', { n: xp })}</Body>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progressToNext * 100) }}
          style={{ height: 12, borderRadius: 3, backgroundColor: palette.surfaceMuted, overflow: 'hidden' }}
        >
          <View style={{ width: `${Math.round(progressToNext * 100)}%`, height: '100%', backgroundColor: palette.accent }} />
        </View>
        <Small>
          {level.nextAt
            ? t('progress.nextLevel', { n: level.nextAt - xp, level: t.dyn(`level.${XP_RULES.levels[level.index + 1].key}`) })
            : t('progress.maxLevel')}
        </Small>
        <Small>{t('progress.levelNote')}</Small>
      </Card>
      <Card>
        <Heading>{t('progress.confidence')}</Heading>
        <Body>{t('progress.confidenceCount', { n: comfortable })}</Body>
        <Small>{t('familiarity.note')}</Small>
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
      {sessions.length === 0 && <Small>{t('progress.historyEmpty')}</Small>}
      {sessions.map((s) => (
        <Card key={s.id}>
          <Small>{formatDate(s.localDate, t.locale)}</Small>
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
