import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Body, Button, Card, Gap, Heading, Pill, Screen, Title } from '../../components/ui';
import { decideSession, type CoachDecision } from '../../domain/coach';
import { COACH_RULES } from '../../domain/rules';
import { nextTrainingDate } from '../../domain/schedule';
import { summariseWeek } from '../../domain/adherence';
import { coachInputFrom, useApp } from '../../features/app/AppState';
import { useT } from '../../i18n';
import { exerciseName, formatDate, reasonText } from '../../i18n/format';

export default function Today() {
  const t = useT();
  const { snapshot, refresh, today, store } = useApp();
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  if (!snapshot?.programme) return <Screen><Body>{t('common.loading')}</Body></Screen>;

  const date = today();
  const input = coachInputFrom(snapshot, date)!;
  const decision: CoachDecision = decideSession(input);
  const week = summariseWeek(snapshot.programme, snapshot.history, date);
  const fmt = (d: string | null) => (d ? formatDate(d, t.locale) : null);

  return (
    <Screen>
      <Body muted>{fmt(date)}</Body>
      <Title>{t('today.greeting')}</Title>
      <Pill label={t('progress.thisWeek', { n: week.attended, target: week.target })} tone="accent" />

      {snapshot.active && (
        <Card tone="accent">
          <Heading>{t('today.resumeWorkout')}</Heading>
          <Body>{t('today.resumeBody')}</Body>
          <Button testID="resume-workout" label={t('today.resumeWorkout')} onPress={() => router.push('/workout')} />
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
          {decision.isReturn && (
            <Card tone="accent">
              <Heading>{t('today.returnTitle')}</Heading>
            </Card>
          )}
          <Card>
            <Heading>{t('today.trainingTitle')}</Heading>
            <Pill label={`${t.dyn(`variant.${decision.variant}`)} · ${t('common.minutes', { n: decision.estimatedMinutes })}`} />
            <Body>{t('today.firstExercise', { name: exerciseName(decision.exercises[0].exerciseId) })}</Body>
            {decision.reasons.map((r, i) => (
              <Body key={i} muted>
                • {reasonText(t.locale, r)}
              </Body>
            ))}
            <Body muted>{t('common.offlineReady')}</Body>
          </Card>
          <Button testID="check-in" label={t('today.checkIn')} onPress={() => router.push('/check-in')} />
          <Button testID="preview" variant="secondary" label={t('today.preview')} onPress={() => router.push('/preview')} />
          <Body muted>{t('today.checkInNote')}</Body>
        </>
      )}

      {decision.kind === 'no_valid_session' && (
        <Card tone="warning">
          <Heading>{t('today.noSessionTitle')}</Heading>
          <Body>{t('noSession.body')}</Body>
          {decision.reasons.map((r, i) => (
            <Body key={i} muted>
              • {reasonText(t.locale, r)}
            </Body>
          ))}
          <Button variant="secondary" label={t('noSession.gym')} onPress={() => router.push('/gym')} />
          <Button variant="secondary" label={t('noSession.learn')} onPress={() => router.push('/(tabs)/learn')} />
        </Card>
      )}

      {decision.kind === 'not_today' && decision.day.kind === 'paused' && (
        <Card>
          <Heading>{t('today.pausedTitle')}</Heading>
          <Body>{t('today.pausedBody')}</Body>
          {decision.day.until && <Body muted>{t('today.pausedUntil', { date: fmt(decision.day.until)! })}</Body>}
          <Button
            label={t('today.resume')}
            onPress={async () => {
              await store.setProgramme({ ...snapshot.programme!, pause: null });
              await refresh();
            }}
          />
        </Card>
      )}

      {decision.kind === 'not_today' && decision.day.kind === 'completed_today' && (
        <Card tone="accent">
          <Heading>{t('today.completedTitle')}</Heading>
          {decision.day.session.outcome === 'safety_stop' ? (
            <Body>{t('today.safetyStoppedBody')}</Body>
          ) : (
            <Body>
              {(() => {
                const n = evaluateNext(snapshot, date);
                return n ? t('today.completedBody', { date: fmt(n)! }) : t('today.noNextVisit');
              })()}
            </Body>
          )}
        </Card>
      )}

      {decision.kind === 'not_today' && decision.day.kind === 'rest' && (
        <>
          <Card>
            <Heading>{t('today.restTitle')}</Heading>
            <Body>
              {decision.day.reason === 'recovery'
                ? t('today.recoveryBody')
                : decision.day.reason === 'weekly_target_met'
                  ? t('today.weeklyDoneBody')
                  : t('today.restBody')}
            </Body>
            {decision.day.missedPlanned > 0 && <Body muted>• {reasonText(t.locale, { code: 'missed_not_doubled', missed: decision.day.missedPlanned })}</Body>}
            <Body muted>{decision.day.nextTrainingDate ? t('today.nextVisit', { date: fmt(decision.day.nextTrainingDate)! }) : t('today.noNextVisit')}</Body>
          </Card>
          {decision.day.canMoveSessionToday && (
            <Card>
              <Button
                testID="move-today"
                variant="secondary"
                label={t('today.moveToday')}
                onPress={async () => {
                  await store.rescheduleTo(date);
                  await refresh();
                }}
              />
              <Body muted>{t('today.moveTodayNote')}</Body>
            </Card>
          )}
          <Button variant="ghost" label={t('today.restLearn')} onPress={() => router.push('/(tabs)/learn')} />
        </>
      )}
      <Gap />
    </Screen>
  );
}

function evaluateNext(snapshot: NonNullable<ReturnType<typeof useApp>['snapshot']>, date: string): string | null {
  return nextTrainingDate(snapshot.programme!, snapshot.history, date, COACH_RULES);
}
