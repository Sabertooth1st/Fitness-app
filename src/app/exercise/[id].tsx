import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ExerciseMedia } from '../../components/ExerciseMedia';
import { MuscleMap } from '../../components/MuscleMap';
import { Body, BulletList, Button, Card, Choice, Heading, Pill, Screen } from '../../components/ui';
import { COACH_RULES, XP_RULES } from '../../domain/rules';
import { evaluateDay } from '../../domain/schedule';
import type { Familiarity } from '../../domain/types';
import { catalogue, useApp } from '../../features/app/AppState';
import { useT } from '../../i18n';

const LEVELS: Familiarity[] = ['new', 'reminder', 'comfortable'];

export default function ExerciseDetail() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store, snapshot, refresh, today } = useApp();
  const exercise = id ? catalogue[id] : undefined;

  // Viewing a lesson counts as learning: one lesson award per day, plus the optional rest-day award.
  useEffect(() => {
    if (!exercise || !snapshot?.programme) return;
    const date = today();
    const day = evaluateDay({ programme: snapshot.programme, history: snapshot.history, today: date, rescheduledDates: snapshot.rescheduledDates, rules: COACH_RULES });
    const ctx = { daysPerWeek: snapshot.programme.daysPerWeek, rules: XP_RULES };
    void (async () => {
      await store.recordLessonView(exercise.id, date);
      await store.award({ type: 'lesson_viewed', localDate: date, exerciseId: exercise.id }, ctx);
      await store.award({ type: 'rest_day_learning', localDate: date, isTrainingDay: day.kind === 'training' }, ctx);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  if (!exercise || !snapshot) return null;
  const excluded = snapshot.exclusions.excludedExerciseIds.includes(exercise.id);
  const alternatives = exercise.alternatives.map((a) => catalogue[a]).filter(Boolean);

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: exercise.name.en }} />
      <Heading>{exercise.name.en}</Heading>
      {exercise.reviewStatus !== 'approved' && <Pill label={t('common.devContent')} tone="warning" />}
      <ExerciseMedia exercise={exercise} />
      <Card>
        <Heading>{t('exercise.equipment')}</Heading>
        <Body>{exercise.equipment.length ? exercise.equipment.map((q) => t.dyn(`equipment.${q}`)).join(' · ') : t('exercise.noEquipment')}</Body>
      </Card>
      <Card>
        <Heading>{t('workout.setup')}</Heading>
        <BulletList items={exercise.setup.en} />
      </Card>
      <Card>
        <Heading>{t('workout.cues')}</Heading>
        {exercise.cues.en.map((c, i) => (
          <Body key={i}>• {c}</Body>
        ))}
      </Card>
      <Card>
        <Heading>{t('workout.mistakes')}</Heading>
        {exercise.mistakes.en.map((c, i) => (
          <Body key={i}>• {c}</Body>
        ))}
      </Card>
      <Card>
        <Heading>{t('exercise.musclesWorked')}</Heading>
        <MuscleMap primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles} />
      </Card>
      <Card tone="danger">
        <Heading>{t('exercise.stop')}</Heading>
        <Body>{exercise.stopGuidance.en}</Body>
      </Card>
      <Card>
        <Heading>{t('familiarity.question')}</Heading>
        <Body muted>{t('familiarity.note')}</Body>
        {LEVELS.map((f) => (
          <Choice
            key={f}
            label={t.dyn(`familiarity.${f}`)}
            selected={(snapshot.familiarity[exercise.id] ?? 'new') === f}
            onPress={async () => {
              await store.setFamiliarity(exercise.id, f);
              await refresh();
            }}
          />
        ))}
      </Card>
      {alternatives.length > 0 && (
        <Card>
          <Heading>{t('exercise.alternatives')}</Heading>
          {alternatives.map((a) => (
            <Button key={a.id} variant="ghost" label={a.name.en} onPress={() => router.push(`/exercise/${a.id}`)} />
          ))}
        </Card>
      )}
      {excluded && <Body>{t('exercise.excluded')}</Body>}
      <Button
        variant="secondary"
        label={excluded ? t('exercise.include') : t('exercise.exclude')}
        onPress={async () => {
          const ids = snapshot.exclusions.excludedExerciseIds;
          await store.setExclusions({
            ...snapshot.exclusions,
            excludedExerciseIds: excluded ? ids.filter((x) => x !== exercise.id) : [...ids, exercise.id],
          });
          await refresh();
        }}
      />
    </Screen>
  );
}
