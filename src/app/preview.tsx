import { router, Stack } from 'expo-router';
import { Body, Button, Card, Heading, Pill, Screen } from '../components/ui';
import { decideSession } from '../domain/coach';
import { COACH_RULES } from '../domain/rules';
import { nextTrainingDate } from '../domain/schedule';
import type { Equipment } from '../domain/types';
import { catalogue, coachInputFrom, useApp } from '../features/app/AppState';
import { useT } from '../i18n';
import { formatDate, reasonText } from '../i18n/format';

/** Full plan preview, available before arrival. Acceptance test 1. */
export default function Preview() {
  const t = useT();
  const { snapshot, today } = useApp();
  if (!snapshot?.programme) return null;
  let date = today();
  let decision = decideSession(coachInputFrom(snapshot, date)!);
  if (decision.kind !== 'train') {
    const next = nextTrainingDate(snapshot.programme, snapshot.history, date, COACH_RULES);
    if (next) {
      date = next;
      decision = decideSession(coachInputFrom(snapshot, next)!);
    }
  }

  if (decision.kind !== 'train') {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: t('preview.title') }} />
        <Body>{t('noSession.body')}</Body>
        {decision.reasons.map((r, i) => (
          <Body key={i} muted>• {reasonText(t.locale, r)}</Body>
        ))}
      </Screen>
    );
  }

  const equipment = [...new Set(decision.exercises.flatMap((e) => catalogue[e.exerciseId].equipment))] as Equipment[];

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: t('preview.title') }} />
      <Heading>{formatDate(date, t.locale)}</Heading>
      <Pill label={`${t.dyn(`variant.${decision.variant}`)} · ${t('preview.duration', { n: decision.estimatedMinutes })}`} tone="accent" />
      {decision.reasons.map((r, i) => (
        <Body key={i} muted>• {reasonText(t.locale, r)}</Body>
      ))}
      {decision.exercises.map((ex, i) => {
        const e = catalogue[ex.exerciseId];
        const p = ex.prescription;
        return (
          <Card key={ex.slotId}>
            <Body muted>{i + 1}</Body>
            <Heading>{e.name.en}</Heading>
            <Body>
              {t(p.setKind === 'familiarisation' ? 'preview.setsRepsFamiliarise' : 'preview.setsReps', { sets: p.sets, min: p.repsMin, max: p.repsMax })}
            </Body>
            <Body muted>{t('preview.rest', { n: p.restSeconds })}</Body>
            {e.reviewStatus !== 'approved' && <Pill label={t('common.devContent')} tone="warning" />}
            <Button variant="secondary" label={t('preview.lesson')} onPress={() => router.push(`/exercise/${e.id}`)} />
          </Card>
        );
      })}
      <Card>
        <Heading>{t('preview.equipmentNeeded')}</Heading>
        <Body>{equipment.length ? equipment.map((q) => t.dyn(`equipment.${q}`)).join(' · ') : t('exercise.noEquipment')}</Body>
      </Card>
      <Card>
        <Heading>{t('preview.packing')}</Heading>
        <Body>{t('preview.packingItems')}</Body>
      </Card>
      <Body muted>{t('common.offlineReady')}</Body>
    </Screen>
  );
}
