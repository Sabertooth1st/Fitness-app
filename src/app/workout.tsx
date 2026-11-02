import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { confirmAction } from '../components/confirm';
import { ExerciseMedia } from '../components/ExerciseMedia';
import { Body, BulletList, Button, Card, Choice, Eyebrow, Heading, Pill, Row, Screen, Small } from '../components/ui';
import { earnsWelcomeBack } from '../domain/adherence';
import { hardDayMilestoneKey, hardDayWins } from '../domain/motivation';
import { suggestLoad, type LoadSuggestion } from '../domain/progression';
import { COACH_RULES, XP_RULES } from '../domain/rules';
import { findSubstitute, type SubstitutionTrigger } from '../domain/substitution';
import type { Effort } from '../domain/types';
import { toDisplay } from '../domain/units';
import { env } from '../config/env';
import { DISABLED_EXERCISE_IDS } from '../config/featureSwitches';
import type { SessionExercise, SetLog, WorkoutSession } from '../data/local/models';
import { catalogue, useApp } from '../features/app/AppState';
import { RestTimer } from '../features/workout/RestTimer';
import { Stepper } from '../features/workout/Stepper';
import { useT } from '../i18n';
import { fonts, radius, spacing } from '../theme/tokens';

type Proposal = { trigger: SubstitutionTrigger; replacementId: string | null } | null;
const EFFORTS: Effort[] = ['easy', 'about_right', 'hard'];

export default function Workout() {
  const t = useT();
  const { store, snapshot, refresh, palette } = useApp();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [reps, setReps] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState<LoadSuggestion | null>(null);
  const [lastLogged, setLastLogged] = useState<SetLog | null>(null);
  const [editing, setEditing] = useState<SetLog | null>(null);
  const [proposal, setProposal] = useState<Proposal>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cheer, setCheer] = useState<string | null>(null);
  const { deal } = useLocalSearchParams<{ deal?: string }>();

  const units = snapshot?.profile?.units ?? 'kg';

  const reload = useCallback(async () => {
    const s = await store.getActiveSession();
    setSession(s);
    return s;
  }, [store]);

  useEffect(() => {
    // Loading persisted state from SQLite on mount; state is set after the async read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload().then((s) => {
      if (!s) router.dismissTo('/(tabs)');
    });
    void store.getDeviceId().then(setDeviceId);
  }, [reload, store]);

  const visible = useMemo(() => session?.exercises.filter((e) => e.status !== 'replaced') ?? [], [session]);
  const index = Math.min(session?.currentIndex ?? 0, Math.max(0, visible.length - 1));
  const current: SessionExercise | undefined = visible[index];
  const exercise = current ? current.snapshot : undefined;
  const loadBasis = exercise?.loadBasis ?? 'bodyweight';

  // Defaults: previous set in this session, else suggestion from last session. Shown as a suggestion, never silently applied.
  useEffect(() => {
    if (!current || !session) return;
    const prev = current.sets[current.sets.length - 1];
    let cancelled = false;
    void store.lastWorkingSets(current.exerciseId).then((history) => {
      if (cancelled) return;
      setEditing(null);
      setProposal(null);
      setShowSetup((snapshot?.familiarity[current.exerciseId] ?? 'new') !== 'comfortable');
      const s = suggestLoad({
        lastSessionSets: history.map((h) => ({ reps: h.reps, weight: h.weight, effort: h.effort })),
        prescription: current.prescription,
        loadBasis,
        preferredUnit: units,
        reentry: session.variant === 'reentry',
        rules: COACH_RULES,
      });
      setSuggestion(s);
      setReps(prev?.reps ?? current.prescription.repsMin);
      if (prev?.weight) setWeight(toDisplay(prev.weight, units).value);
      else if (s.kind === 'suggest') setWeight(s.weight.value);
      else setWeight(null);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!session || !current || !exercise) {
    return (
      <Screen>
        <Body>{t('common.loading')}</Body>
      </Screen>
    );
  }

  const done = current.sets.length >= current.prescription.sets;
  const isLast = index === visible.length - 1;
  const ctx = {
    constraints: {
      availableEquipment: snapshot?.gym?.equipment ?? [],
      excludedExerciseIds: snapshot?.exclusions.excludedExerciseIds ?? [],
      excludedEquipment: snapshot?.exclusions.excludedEquipment ?? [],
    },
    environment: env.appEnv,
    disabledExerciseIds: DISABLED_EXERCISE_IDS,
  };

  async function logSet() {
    if (reps === null || saving) return;
    setSaving(true);
    try {
      const w = loadBasis === 'bodyweight' || weight === null ? null : { value: weight, unit: units, basis: loadBasis };
      if (editing) {
        await store.updateSet(editing.id, { reps, weight: w });
        setEditing(null);
      } else {
        const log = await store.logSet({ sessionExerciseId: current!.id, reps, weight: w, effort: null, kind: current!.prescription.setKind });
        setLastLogged(log);
        const lines = t.list('workout.setDone');
        setCheer(lines[(log.setIndex + index) % lines.length]);
        await store.setRestUntil(session!.id, Date.now() + current!.prescription.restSeconds * 1000);
      }
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function setEffort(effort: Effort) {
    if (!lastLogged) return;
    await store.updateSet(lastLogged.id, { effort });
    setLastLogged({ ...lastLogged, effort });
    await reload();
  }

  async function goTo(i: number) {
    await store.setCurrentIndex(session!.id, i);
    setLastLogged(null);
    setCheer(null);
    await reload();
  }

  function propose(trigger: SubstitutionTrigger) {
    const r = findSubstitute({
      session: session!.exercises.map((e) => ({ exerciseId: e.exerciseId, loggedSets: e.sets.length, status: e.status })),
      index: session!.exercises.indexOf(current!),
      trigger,
      catalogue,
      familiarity: snapshot?.familiarity ?? {},
      ctx,
    });
    setProposal({ trigger, replacementId: r.ok ? r.replacementId : null });
    if (trigger === 'unsure') setShowSetup(true);
  }

  async function acceptSubstitute() {
    if (!proposal?.replacementId) return;
    await store.substituteExercise(current!.id, catalogue[proposal.replacementId], proposal.trigger);
    setProposal(null);
    await reload();
  }

  async function painStop() {
    await store.finishSession(session!.id, { safetyStop: true });
    await refresh();
    router.replace('/safety');
  }

  async function finish() {
    const finished = await store.finishSession(session!.id);
    const programme = snapshot?.programme;
    if (programme && finished.outcome) {
      await store.award(
        { type: 'mission_complete', localDate: finished.localDate, sessionId: finished.id, variant: finished.variant, outcome: finished.outcome },
        { daysPerWeek: programme.daysPerWeek, rules: XP_RULES },
      );
      const already = (snapshot?.milestones ?? []).some((m) => m.key === 'welcome_back');
      if (earnsWelcomeBack(already, finished.isReturn, finished.outcome)) await store.earnMilestone('welcome_back', finished.localDate);
      if (finished.outcome !== 'abandoned') await store.earnMilestone('first_session', finished.localDate);
      if (finished.hardDay) {
        const key = hardDayMilestoneKey(hardDayWins(await store.listHistory()));
        if (key) await store.earnMilestone(key, finished.localDate);
      }
    }
    await refresh();
    router.replace(`/summary/${finished.id}`);
  }

  function confirmFinish() {
    const incomplete = visible.some((e) => e.status !== 'done' && e.status !== 'skipped');
    if (!incomplete) return void finish();
    confirmAction({
      title: t('workout.finish'),
      message: t('workout.finishConfirm'),
      confirm: t('workout.finish'),
      cancel: t('common.cancel'),
      onConfirm: () => void finish(),
    });
  }

  const basisLabel = loadBasis === 'per_hand' ? t('workout.perHand') : loadBasis === 'machine_stack' ? t('workout.machineStack') : t('workout.total');
  const p = current.prescription;
  const pal = palette;
  const firstExerciseDone = (visible[0]?.sets.length ?? 0) > 0 && (visible[0]?.status === 'done' || index > 0);

  return (
    <Screen>
      {/* Session progress: one block per exercise. */}
      <View accessible accessibilityLabel={t('workout.exerciseOf', { n: index + 1, total: visible.length })} style={{ flexDirection: 'row', gap: 4 }}>
        {visible.map((e, i) => (
          <View
            key={e.id}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: e.status === 'done' ? pal.accent : i === index ? pal.text : pal.surfaceMuted,
              opacity: e.status === 'skipped' ? 0.35 : 1,
            }}
          />
        ))}
      </View>
      <Row gap={spacing.sm} wrap>
        <Eyebrow tone="accent">{t('workout.exerciseOf', { n: index + 1, total: visible.length })}</Eyebrow>
        <Pill label={t.dyn(`variant.${session.variant}`)} />
        {session.hardDay && <Pill tone="solid" label={t('hardDay.title')} />}
      </Row>

      {deviceId && session.deviceId !== deviceId && (
        <Card tone="warning">
          <Body>{t('workout.otherDevice')}</Body>
        </Card>
      )}

      {deal === '1' && firstExerciseDone && (
        <Card tone="accent">
          <Body bold>{t('workout.minimumMet')}</Body>
        </Card>
      )}

      <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: pal.text, textTransform: 'uppercase' }}>
        {exercise.name.en}
      </Text>

      {/* Set tracker */}
      <View style={{ backgroundColor: pal.surface, borderColor: pal.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md }}>
        <Row gap={spacing.md}>
          <View style={{ flex: 1 }}>
            <Eyebrow>{done ? t('workout.allSetsDone') : t('workout.setOf', { n: current.sets.length + 1, total: p.sets })}</Eyebrow>
            <Text style={{ fontFamily: fonts.display, fontSize: 44, lineHeight: 46, color: done ? pal.success : pal.text, fontVariant: ['tabular-nums'] }}>
              {Math.min(current.sets.length + (done ? 0 : 1), p.sets)}/{p.sets}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Small>{t(p.setKind === 'familiarisation' ? 'preview.setsRepsFamiliarise' : 'preview.setsReps', { sets: p.sets, min: p.repsMin, max: p.repsMax })}</Small>
            <Row gap={6}>
              {Array.from({ length: p.sets }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: i < current.sets.length ? pal.accent : 'transparent',
                    borderWidth: 2,
                    borderColor: i < current.sets.length ? pal.accent : pal.textMuted,
                  }}
                />
              ))}
            </Row>
          </View>
        </Row>

        {suggestion?.kind === 'familiarise' && current.sets.length === 0 && <Small muted={false}>{t('workout.familiarise')}</Small>}
        {suggestion?.kind === 'suggest' && current.sets.length === 0 && (
          <Small muted={false}>
            {suggestion.change === 'reentry' ? t('workout.suggestedReentry') : t('workout.suggested')}: {suggestion.weight.value} {suggestion.weight.unit} {basisLabel}
          </Small>
        )}

        <Stepper testID="reps-input" label={t('workout.reps')} value={reps} onChange={setReps} step={1} />
        {loadBasis === 'bodyweight' ? (
          <Small>{t('workout.bodyweight')}</Small>
        ) : (
          <Stepper
            testID="weight-input"
            label={t('workout.weight')}
            suffix={`${units}, ${basisLabel}`}
            value={weight}
            onChange={setWeight}
            step={units === 'kg' ? (loadBasis === 'per_hand' ? 1 : 2.5) : 5}
            placeholder="—"
          />
        )}
        <Button testID="log-set" size="large" label={editing ? t('common.save') : t('workout.logSet')} onPress={logSet} disabled={reps === null || saving || (done && !editing)} />

        {current.sets.length > 0 && (
          <View style={{ gap: 2 }}>
            {current.sets.map((s) => {
              const w = s.weight ? toDisplay(s.weight, units) : null;
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityHint={t('workout.editHint')}
                  onPress={() => {
                    setEditing(s);
                    setReps(s.reps);
                    setWeight(w?.value ?? null);
                  }}
                  style={{ paddingVertical: 6, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: fonts.bodyBold, color: editing?.id === s.id ? pal.accentInk : pal.success, width: 18 }}>
                    {editing?.id === s.id ? '✎' : '✓'}
                  </Text>
                  <Body>
                    {t('workout.loggedSet', { n: s.setIndex + 1, reps: s.reps, weight: w ? ` · ${w.value} ${w.unit}` : '' })}
                    {s.effort ? ` · ${t.dyn(`workout.effort_${s.effort}`)}` : ''}
                  </Body>
                </Pressable>
              );
            })}
            <Small>{t('workout.editHint')}</Small>
          </View>
        )}
      </View>

      {cheer && (
        <Text style={{ fontFamily: fonts.displaySemi, fontSize: 22, color: pal.accentInk, textTransform: 'uppercase' }}>{cheer}</Text>
      )}

      {lastLogged && lastLogged.effort === null && (
        <Card>
          <Body bold>{t('workout.effortQuestion')}</Body>
          {EFFORTS.map((e) => (
            <Choice compact key={e} testID={`effort-${e}`} label={t.dyn(`workout.effort_${e}`)} selected={false} onPress={() => setEffort(e)} />
          ))}
        </Card>
      )}

      {session.restUntil !== null && (
        <RestTimer
          deadline={session.restUntil}
          onSkip={async () => {
            await store.setRestUntil(session.id, null);
            await reload();
          }}
        />
      )}

      {proposal && (
        <Card tone={proposal.replacementId ? 'accent' : 'warning'}>
          {proposal.trigger === 'unsure' && (
            <>
              <Eyebrow tone="accent">{t('workout.askStaff')}</Eyebrow>
              <Body>{t('workout.askStaffScript', { equipment: exercise.equipment.map((q) => t.dyn(`equipment.${q}`)).join(', ') || exercise.name.en })}</Body>
            </>
          )}
          {proposal.replacementId ? (
            <>
              <Heading>{t('workout.substituteTitle')}</Heading>
              <Body>{t('workout.substituteBody', { name: catalogue[proposal.replacementId].name.en })}</Body>
              <BulletList items={catalogue[proposal.replacementId].setup.en} />
              <Button testID="use-substitute" label={t('workout.substituteUse')} onPress={acceptSubstitute} />
            </>
          ) : (
            <>
              <Body>{t('workout.noSubstitute')}</Body>
              <Button
                variant="secondary"
                label={t('workout.skip')}
                onPress={async () => {
                  await store.skipExercise(current.id);
                  setProposal(null);
                  await reload();
                }}
              />
            </>
          )}
          <Button variant="ghost" label={t('common.close')} onPress={() => setProposal(null)} />
        </Card>
      )}

      <Row gap={spacing.sm} wrap>
        <View style={{ flexBasis: '47%', flexGrow: 1 }}>
          <Button testID="busy" variant="secondary" label={t('workout.busy')} onPress={() => propose('busy')} disabled={done} />
        </View>
        <View style={{ flexBasis: '47%', flexGrow: 1 }}>
          <Button testID="too-hard" variant="secondary" label={t('workout.tooHard')} onPress={() => propose('too_hard')} disabled={done} />
        </View>
        <View style={{ flexBasis: '47%', flexGrow: 1 }}>
          <Button testID="unsure" variant="secondary" label={t('workout.unsure')} onPress={() => propose('unsure')} disabled={done} />
        </View>
        <View style={{ flexBasis: '47%', flexGrow: 1 }}>
          <Button testID="pain" variant="danger" label={t('workout.pain')} onPress={painStop} />
        </View>
      </Row>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showSetup }}
        onPress={() => setShowSetup(!showSetup)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 }}
      >
        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: pal.accentInk }}>{showSetup ? '−' : '+'}</Text>
        <Heading>{t('preview.lesson')}</Heading>
      </Pressable>
      {showSetup && (
        <>
          <ExerciseMedia exercise={exercise} />
          <Card>
            <Eyebrow tone="accent">{t('workout.setup')}</Eyebrow>
            <BulletList items={exercise.setup.en} />
            <Eyebrow tone="accent">{t('workout.cues')}</Eyebrow>
            {exercise.cues.en.map((c, i) => (
              <Body key={i}>• {c}</Body>
            ))}
            <Small>
              {t('exercise.musclesWorked')}: {exercise.primaryMuscles.map((m) => t.dyn(`muscle.${m}`)).join(', ')}
            </Small>
          </Card>
        </>
      )}

      <Row gap={spacing.sm}>
        {index > 0 && (
          <View style={{ flex: 1 }}>
            <Button variant="secondary" label={t('workout.previous')} onPress={() => goTo(index - 1)} />
          </View>
        )}
        <View style={{ flex: 2 }}>
          {isLast ? (
            <Button testID="finish" label={t('workout.finish')} onPress={confirmFinish} />
          ) : (
            <Button testID="next-exercise" label={t('workout.next')} variant={done ? 'primary' : 'secondary'} onPress={() => goTo(index + 1)} />
          )}
        </View>
      </Row>
      {!isLast && <Button variant="ghost" label={t('workout.finish')} onPress={confirmFinish} />}
      {exercise.reviewStatus !== 'approved' && <Small>{t('common.devContent')}</Small>}
    </Screen>
  );
}
