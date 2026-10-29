import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Body, Button, Choice, Heading, Row, Screen } from '../components/ui';
import { FULL_BODY_TEMPLATE_DEV } from '../content/templates.dev';
import { validateWeekdays } from '../domain/schedule';
import { ALL_EQUIPMENT, type Equipment, type Experience, type Goal, type Weekday, type WeightUnit } from '../domain/types';
import { useApp } from '../features/app/AppState';
import { useT } from '../i18n';
import { radius, spacing } from '../theme/tokens';

const GOALS: Goal[] = ['general_strength', 'confidence', 'everyday_health'];
const EXPERIENCES: Experience[] = ['new', 'some', 'returning'];
const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const DURATIONS = [20, 30, 45, 60];
const TOTAL_STEPS = 7;

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export default function Onboarding() {
  const t = useT();
  const { store, snapshot, refresh, today, palette } = useApp();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const existing = snapshot?.profile;
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<Goal>(existing?.goal ?? 'confidence');
  const [experience, setExperience] = useState<Experience>(existing?.experience ?? 'new');
  const [days, setDays] = useState<Weekday[]>(snapshot?.programme?.preferredWeekdays ?? [1, 3, 5]);
  const [minutes, setMinutes] = useState(snapshot?.programme?.sessionMinutes ?? 45);
  const [equipment, setEquipment] = useState<Equipment[]>(snapshot?.gym?.equipment ?? [...ALL_EQUIPMENT]);
  const [gymLabel, setGymLabel] = useState(snapshot?.gym?.label ?? '');
  const [units, setUnits] = useState<WeightUnit>(existing?.units ?? 'kg');
  const [excluded, setExcluded] = useState<Equipment[]>(snapshot?.exclusions.excludedEquipment ?? []);

  const daysValid = validateWeekdays(days);

  async function finish() {
    await store.setProfile({
      adultConfirmed: true,
      goal,
      experience,
      units,
      locale: existing?.locale ?? 'en',
      theme: existing?.theme ?? 'system',
      reducedMotion: existing?.reducedMotion ?? 'system',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
    await store.setProgramme({
      templateId: FULL_BODY_TEMPLATE_DEV.id,
      templateVersion: FULL_BODY_TEMPLATE_DEV.version,
      daysPerWeek: days.length as 2 | 3,
      preferredWeekdays: [...days].sort((a, b) => a - b),
      startDate: snapshot?.programme?.startDate ?? today(),
      sessionMinutes: minutes,
      pause: snapshot?.programme?.pause ?? null,
    });
    await store.setGym({ label: gymLabel.trim() || t('onboarding.gymLabelPlaceholder'), equipment, pin: snapshot?.gym?.pin ?? null });
    await store.setExclusions({ excludedEquipment: excluded, excludedExerciseIds: snapshot?.exclusions.excludedExerciseIds ?? [] });
    await refresh();
    if (edit) router.back();
    else router.replace('/(tabs)');
  }

  const next = () => (step < TOTAL_STEPS ? setStep(step + 1) : void finish());

  return (
    <Screen edges={['bottom']}>
      <Body muted>{t('onboarding.stepOf', { n: step, total: TOTAL_STEPS })}</Body>
      {step === 1 && (
        <>
          <Heading>{t('onboarding.goalTitle')}</Heading>
          {GOALS.map((g) => (
            <Choice key={g} label={t.dyn(`onboarding.goal_${g}`)} selected={goal === g} onPress={() => setGoal(g)} />
          ))}
        </>
      )}
      {step === 2 && (
        <>
          <Heading>{t('onboarding.experienceTitle')}</Heading>
          {EXPERIENCES.map((e) => (
            <Choice key={e} label={t.dyn(`onboarding.experience_${e}`)} selected={experience === e} onPress={() => setExperience(e)} />
          ))}
        </>
      )}
      {step === 3 && (
        <>
          <Heading>{t('onboarding.daysTitle')}</Heading>
          <Body muted>{t('onboarding.daysHint')}</Body>
          {WEEKDAYS.map((d) => (
            <Choice key={d} multi testID={`day-${d}`} label={t.dyn(`weekdayLong.${d}`)} selected={days.includes(d)} onPress={() => setDays(toggle(days, d))} />
          ))}
          {!daysValid && <Body>{t('onboarding.daysError')}</Body>}
        </>
      )}
      {step === 4 && (
        <>
          <Heading>{t('onboarding.durationTitle')}</Heading>
          {DURATIONS.map((m) => (
            <Choice key={m} label={t('common.minutes', { n: m })} selected={minutes === m} onPress={() => setMinutes(m)} />
          ))}
        </>
      )}
      {step === 5 && (
        <>
          <Heading>{t('onboarding.equipmentTitle')}</Heading>
          <Body muted>{t('onboarding.equipmentHint')}</Body>
          <View style={{ gap: spacing.xs }}>
            <Body>{t('onboarding.gymLabel')}</Body>
            <TextInput
              value={gymLabel}
              onChangeText={setGymLabel}
              placeholder={t('onboarding.gymLabelPlaceholder')}
              placeholderTextColor={palette.textMuted}
              accessibilityLabel={t('onboarding.gymLabel')}
              style={{
                minHeight: 50,
                borderWidth: 1,
                borderColor: palette.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                color: palette.text,
                backgroundColor: palette.surface,
                fontSize: 16,
              }}
            />
          </View>
          {ALL_EQUIPMENT.map((e) => (
            <Choice key={e} multi label={t.dyn(`equipment.${e}`)} selected={equipment.includes(e)} onPress={() => setEquipment(toggle(equipment, e))} />
          ))}
        </>
      )}
      {step === 6 && (
        <>
          <Heading>{t('onboarding.unitsTitle')}</Heading>
          <Choice label="kg" selected={units === 'kg'} onPress={() => setUnits('kg')} />
          <Choice label="lb" selected={units === 'lb'} onPress={() => setUnits('lb')} />
        </>
      )}
      {step === 7 && (
        <>
          <Heading>{t('onboarding.exclusionsTitle')}</Heading>
          <Body muted>{t('onboarding.exclusionsHint')}</Body>
          {ALL_EQUIPMENT.map((e) => (
            <Choice key={e} multi label={t.dyn(`equipment.${e}`)} selected={excluded.includes(e)} onPress={() => setExcluded(toggle(excluded, e))} />
          ))}
        </>
      )}
      <Row gap={spacing.sm}>
        {step > 1 && (
          <View style={{ flex: 1 }}>
            <Button variant="secondary" label={t('common.back')} onPress={() => setStep(step - 1)} />
          </View>
        )}
        <View style={{ flex: 2 }}>
          <Button
            testID="onboarding-next"
            label={step === TOTAL_STEPS ? t('onboarding.finish') : t('common.continue')}
            disabled={step === 3 && !daysValid}
            onPress={next}
          />
        </View>
      </Row>
    </Screen>
  );
}
