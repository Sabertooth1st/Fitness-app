import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ExerciseMedia } from '../../components/ExerciseMedia';
import { MuscleMap } from '../../components/MuscleMap';
import { Body, BulletList, Button, Card, Choice, Eyebrow, Pill, Row, Screen, Small, Title } from '../../components/ui';
import { COACH_RULES, XP_RULES } from '../../domain/rules';
import { evaluateDay } from '../../domain/schedule';
import type { Familiarity } from '../../domain/types';
import { catalogue, useApp } from '../../features/app/AppState';
import { useT } from '../../i18n';
import { spacing } from '../../theme/tokens';

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
  const related = (ids: string[]) => ids.map((a) => catalogue[a]).filter(Boolean);
  const alternatives = related(exercise.alternatives);
  const easier = related(exercise.regressions);
  const harder = related(exercise.progressions);
  const links = (title: string, list: typeof alternatives) =>
    list.length > 0 && (
      <Card>
        <Eyebrow tone="accent">{title}</Eyebrow>
        {list.map((a) => (
          <Button key={a.id} variant="secondary" label={a.name.en} onPress={() => router.push(`/exercise/${a.id}`)} />
        ))}
      </Card>
    );

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: exercise.name.en }} />
      <Eyebrow tone="accent">{t.dyn(`pattern.${exercise.pattern}`)}</Eyebrow>
      <Title>{exercise.name.en}</Title>
      <Row gap={spacing.sm} wrap>
        <Pill tone="solid" label={t.dyn(`learn.difficulty_${exercise.skill}`)} />
        {exercise.reviewStatus !== 'approved' && <Pill label={t('common.devContent')} tone="warning" />}
      </Row>
      <ExerciseMedia exercise={exercise} />
      <Card>
        <Eyebrow tone="accent">{t('exercise.equipment')}</Eyebrow>
        <Body>{exercise.equipment.length ? exercise.equipment.map((q) => t.dyn(`equipment.${q}`)).join(' · ') : t('exercise.noEquipment')}</Body>
      </Card>
      <Card>
        <Eyebrow tone="accent">{t('workout.setup')}</Eyebrow>
        <BulletList items={exercise.setup.en} />
      </Card>
      <Card>
        <Eyebrow tone="accent">{t('workout.cues')}</Eyebrow>
        {exercise.cues.en.map((c, i) => (
          <Body key={i}>• {c}</Body>
        ))}
      </Card>
      <Card>
        <Eyebrow tone="accent">{t('workout.mistakes')}</Eyebrow>
        {exercise.mistakes.en.map((c, i) => (
          <Body key={i}>• {c}</Body>
        ))}
      </Card>
      <Card>
        <Eyebrow tone="accent">{t('exercise.musclesWorked')}</Eyebrow>
        <MuscleMap primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles} />
      </Card>
      <Card tone="danger">
        <Eyebrow tone="accent">{t('exercise.stop')}</Eyebrow>
        <Body>{exercise.stopGuidance.en}</Body>
      </Card>
      <Card>
        <Eyebrow tone="accent">{t('familiarity.question')}</Eyebrow>
        <Small>{t('familiarity.note')}</Small>
        {LEVELS.map((f) => (
          <Choice
            compact
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
      {links(t('exercise.easier'), easier)}
      {links(t('exercise.alternatives'), alternatives)}
      {links(t('exercise.harder'), harder)}
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
