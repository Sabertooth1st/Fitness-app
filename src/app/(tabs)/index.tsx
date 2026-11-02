import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FlameIcon } from '../../components/icons';
import { Body, Button, Card, Display, Eyebrow, Pill, Row, Screen, Segments, Small, Stat } from '../../components/ui';
import { summariseWeek } from '../../domain/adherence';
import { decideSession, type CoachDecision } from '../../domain/coach';
import { dailyIndex, hardDayWins, weeksInARow } from '../../domain/motivation';
import { COACH_RULES } from '../../domain/rules';
import { nextTrainingDate } from '../../domain/schedule';
import { catalogue, coachInputFrom, useApp } from '../../features/app/AppState';
import { useT } from '../../i18n';
import { exerciseName, formatDate, reasonText } from '../../i18n/format';
import { fonts, radius, spacing } from '../../theme/tokens';

export default function Today() {
  const t = useT();
  const { snapshot, refresh, today, store, palette: p } = useApp();
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  if (!snapshot?.programme) {
    return (
      <Screen>
        <Body>{t('common.loading')}</Body>
      </Screen>
    );
  }

  const date = today();
  const programme = snapshot.programme;
  const decision: CoachDecision = decideSession(coachInputFrom(snapshot, date)!);
  const week = summariseWeek(programme, snapshot.history, date);
  const lines = t.list('motivation.lines');
  const line = lines[dailyIndex(date, lines.length)];
  const fmt = (d: string | null) => (d ? formatDate(d, t.locale) : null);

  const headline =
    snapshot.active
      ? t('today.resumeWorkout')
      : decision.kind === 'train'
        ? decision.isReturn
          ? t('today.returnTitle')
          : t('today.trainingTitle')
        : decision.kind === 'not_today' && decision.day.kind === 'completed_today'
          ? t('today.completedTitle')
          : decision.kind === 'not_today' && decision.day.kind === 'paused'
            ? t('today.pausedTitle')
            : decision.kind === 'no_valid_session'
              ? t('today.noSessionTitle')
              : t('today.restTitle');

  return (
    <Screen>
      <Row gap={spacing.sm}>
        <View style={{ flex: 1 }}>
          <Eyebrow>{fmt(date)}</Eyebrow>
        </View>
      </Row>
      <Display tone={decision.kind === 'train' || snapshot.active ? 'accent' : 'text'}>{headline}</Display>

      <View style={{ borderLeftWidth: 4, borderLeftColor: p.accent, paddingLeft: spacing.md, paddingVertical: 2 }}>
        <Text style={{ fontFamily: fonts.displaySemi, fontSize: 21, lineHeight: 25, color: p.text }}>{line}</Text>
      </View>

      <Segments done={Math.min(week.attended, week.target)} target={week.target} label={t('progress.thisWeek', { n: week.attended, target: week.target })} />
      <Row gap={spacing.sm}>
        <Stat testID="stat-weeks" value={weeksInARow(programme, snapshot.history, date)} label={t('motivation.weeksInARow')} />
        <Stat testID="stat-hard-days" value={hardDayWins(snapshot.history)} label={t('motivation.hardDayCount')} />
      </Row>

      {snapshot.active && (
        <Card tone="accent">
          <Body>{t('today.resumeBody')}</Body>
          <Button testID="resume-workout" size="large" label={t('today.resumeWorkout')} onPress={() => router.push('/workout')} />
        </Card>
      )}

      {(!snapshot.gym || snapshot.gym.equipment.length === 0) && (
        <Card tone="warning">
          <Body>{t('today.noGym')}</Body>
          <Button variant="secondary" label={t('profile.gym')} onPress={() => router.push('/gym')} />
        </Card>
      )}

      {decision.kind === 'train' && !snapshot.active && (
        <>
          <Card>
            <Row gap={spacing.sm} wrap>
              <Pill tone="solid" label={t.dyn(`variant.${decision.variant}`)} />
              <Pill label={t('common.minutes', { n: decision.estimatedMinutes })} />
              <Pill label={t('today.exercises', { n: decision.exercises.length })} />
            </Row>
            <View style={{ gap: 6 }}>
              {decision.exercises.map((ex, i) => (
                <Pressable
                  key={ex.slotId}
                  accessibilityRole="button"
                  onPress={() => router.push(`/exercise/${ex.exerciseId}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 }}
                >
                  <Text style={{ fontFamily: fonts.display, fontSize: 18, width: 22, color: i === 0 ? p.accentInk : p.textMuted }}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Body bold={i === 0}>{exerciseName(ex.exerciseId)}</Body>
                  </View>
                  <Small>
                    {ex.prescription.sets}×{ex.prescription.repsMin}–{ex.prescription.repsMax}
                  </Small>
                </Pressable>
              ))}
            </View>
            {decision.reasons
              .filter((r) => r.code !== 'standard_session')
              .map((r, i) => (
                <Small key={i}>• {reasonText(t.locale, r)}</Small>
              ))}
          </Card>
          <Button testID="check-in" size="large" label={t('today.checkIn')} onPress={() => router.push('/check-in')} />
          <Pressable
            testID="hard-day"
            accessibilityRole="button"
            accessibilityLabel={t('motivation.hardDayCta')}
            onPress={() => router.push('/hard-day')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              minHeight: 54,
              borderRadius: radius.md,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: p.accent,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <FlameIcon color={p.accentInk} size={20} />
            <Text style={{ fontFamily: fonts.displaySemi, fontSize: 18, letterSpacing: 0.5, color: p.accentInk, textTransform: 'uppercase' }}>
              {t('motivation.hardDayCta')}
            </Text>
          </Pressable>
          <Button testID="preview" variant="secondary" label={t('today.preview')} onPress={() => router.push('/preview')} />
          <Small>{t('common.offlineReady')}</Small>
        </>
      )}

      {decision.kind === 'no_valid_session' && (
        <Card tone="warning">
          <Body>{t('noSession.body')}</Body>
          {decision.reasons.map((r, i) => (
            <Small key={i}>• {reasonText(t.locale, r)}</Small>
          ))}
          <Button variant="secondary" label={t('noSession.gym')} onPress={() => router.push('/gym')} />
          <Button variant="secondary" label={t('noSession.learn')} onPress={() => router.push('/(tabs)/learn')} />
        </Card>
      )}

      {decision.kind === 'not_today' && decision.day.kind === 'paused' && (
        <Card>
          <Body>{t('today.pausedBody')}</Body>
          {decision.day.until && <Small>{t('today.pausedUntil', { date: fmt(decision.day.until)! })}</Small>}
          <Button
            label={t('today.resume')}
            onPress={async () => {
              await store.setProgramme({ ...programme, pause: null });
              await refresh();
            }}
          />
        </Card>
      )}

      {decision.kind === 'not_today' && decision.day.kind === 'completed_today' && (
        <Card tone="accent">
          {decision.day.session.outcome === 'safety_stop' ? (
            <Body>{t('today.safetyStoppedBody')}</Body>
          ) : (
            <Body>
              {(() => {
                const n = nextTrainingDate(programme, snapshot.history, date, COACH_RULES);
                return n ? t('today.completedBody', { date: fmt(n)! }) : t('today.noNextVisit');
              })()}
            </Body>
          )}
        </Card>
      )}

      {decision.kind === 'not_today' && decision.day.kind === 'rest' && (
        <>
          <Card>
            <Body>
              {decision.day.reason === 'recovery'
                ? t('today.recoveryBody')
                : decision.day.reason === 'weekly_target_met'
                  ? t('today.weeklyDoneBody')
                  : t('today.restBody')}
            </Body>
            {decision.day.missedPlanned > 0 && <Small>• {reasonText(t.locale, { code: 'missed_not_doubled', missed: decision.day.missedPlanned })}</Small>}
            <Eyebrow tone="accent">
              {decision.day.nextTrainingDate ? t('today.nextVisit', { date: fmt(decision.day.nextTrainingDate)! }) : t('today.noNextVisit')}
            </Eyebrow>
          </Card>
          {decision.day.canMoveSessionToday && (
            <>
              <Button
                testID="move-today"
                label={t('today.moveToday')}
                onPress={async () => {
                  await store.rescheduleTo(date);
                  await refresh();
                }}
              />
              <Small>{t('today.moveTodayNote')}</Small>
            </>
          )}
          <Button variant="secondary" label={t('today.preview')} onPress={() => router.push('/preview')} />
          <Button variant="ghost" label={t('today.restLearn')} onPress={() => router.push('/(tabs)/learn')} />
        </>
      )}
      {decision.kind === 'train' && catalogue[decision.exercises[0].exerciseId]?.reviewStatus !== 'approved' && <Small>{t('common.devContent')}</Small>}
    </Screen>
  );
}
