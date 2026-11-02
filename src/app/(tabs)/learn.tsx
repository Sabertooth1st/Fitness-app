import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Body, Choice, Eyebrow, Pill, Row, Screen, Small, Title } from '../../components/ui';
import { DEV_EXERCISES } from '../../content/exercises.dev';
import { ALL_EQUIPMENT, type Equipment, type MovementPattern, type Muscle } from '../../domain/types';
import { useApp } from '../../features/app/AppState';
import { useT } from '../../i18n';
import { fonts, radius, spacing } from '../../theme/tokens';

const PATTERNS: MovementPattern[] = [
  'squat',
  'lunge',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'chest_fly',
  'horizontal_pull',
  'vertical_pull',
  'shoulder_raise',
  'elbow_flexion',
  'elbow_extension',
  'knee_flexion',
  'knee_extension',
  'calf_raise',
  'trunk',
  'carry',
  'conditioning',
];
const MUSCLES: Muscle[] = ['chest', 'upper_back', 'lats', 'front_shoulders', 'side_shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals'];
const BASICS = ['sets', 'weight', 'rest', 'etiquette', 'soreness'] as const;

export default function Learn() {
  const t = useT();
  const { palette: p, snapshot } = useApp();
  const [query, setQuery] = useState('');
  const [pattern, setPattern] = useState<MovementPattern | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [skill, setSkill] = useState<1 | 2 | 3 | null>(null);
  const [openBasic, setOpenBasic] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEV_EXERCISES.filter((e) => e.reviewStatus !== 'rejected')
      .filter((e) => !q || e.name.en.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)))
      .filter((e) => !pattern || e.pattern === pattern)
      .filter((e) => !equipment || e.equipment.includes(equipment))
      .filter((e) => !muscle || e.primaryMuscles.includes(muscle) || e.secondaryMuscles.includes(muscle))
      .filter((e) => !skill || e.skill === skill)
      .sort((a, b) => a.skill - b.skill || a.name.en.localeCompare(b.name.en));
  }, [query, pattern, equipment, muscle, skill]);

  const chipRow = <T,>(items: (T | null)[], value: T | null, set: (v: T | null) => void, label: (v: T | null) => string, id: string) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {items.map((v, i) => (
        <Choice compact testID={`${id}-${String(v)}`} key={i} label={label(v)} selected={value === v} onPress={() => set(v)} />
      ))}
    </ScrollView>
  );

  return (
    <Screen>
      <Title>{t('learn.title')}</Title>
      <Small>{t('learn.subtitle')}</Small>

      <Eyebrow tone="accent">{t('learn.basicsTitle')}</Eyebrow>
      <View style={{ gap: spacing.sm }}>
        {BASICS.map((b) => {
          const open = openBasic === b;
          return (
            <Pressable
              key={b}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => setOpenBasic(open ? null : b)}
              style={{ backgroundColor: p.surface, borderColor: open ? p.accent : p.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs }}
            >
              <Row gap={spacing.sm}>
                <Text style={{ fontFamily: fonts.display, fontSize: 18, color: p.accentInk, width: 14 }}>{open ? '−' : '+'}</Text>
                <Text style={{ fontFamily: fonts.displaySemi, fontSize: 19, color: p.text, textTransform: 'uppercase', flex: 1 }}>{t.dyn(`basics.${b}_title`)}</Text>
              </Row>
              {open && <Body>{t.dyn(`basics.${b}_body`)}</Body>}
            </Pressable>
          );
        })}
      </View>

      <TextInput
        testID="learn-search"
        value={query}
        onChangeText={setQuery}
        placeholder={t('learn.search')}
        placeholderTextColor={p.textMuted}
        accessibilityLabel={t('learn.search')}
        style={{
          minHeight: 52,
          borderWidth: 1,
          borderColor: p.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          color: p.text,
          backgroundColor: p.surface,
          fontSize: 16,
          fontFamily: fonts.body,
        }}
      />
      <Eyebrow>{t('learn.filterPattern')}</Eyebrow>
      {chipRow<MovementPattern>([null, ...PATTERNS], pattern, setPattern, (v) => (v ? t.dyn(`pattern.${v}`) : t('learn.any')), 'pattern')}
      <Eyebrow>{t('learn.filterEquipment')}</Eyebrow>
      {chipRow<Equipment>([null, ...ALL_EQUIPMENT], equipment, setEquipment, (v) => (v ? t.dyn(`equipment.${v}`) : t('learn.any')), 'equipment')}
      <Eyebrow>{t('learn.filterMuscle')}</Eyebrow>
      {chipRow<Muscle>([null, ...MUSCLES], muscle, setMuscle, (v) => (v ? t.dyn(`muscle.${v}`) : t('learn.any')), 'muscle')}
      <Eyebrow>{t('learn.filterDifficulty')}</Eyebrow>
      {chipRow<1 | 2 | 3>([null, 1, 2, 3], skill, setSkill, (v) => (v ? t.dyn(`learn.difficulty_${v}`) : t('learn.any')), 'skill')}

      <Eyebrow tone="accent">{t('learn.count', { n: results.length })}</Eyebrow>
      {results.length === 0 && <Body>{t('learn.empty')}</Body>}
      {results.map((e) => (
        <Pressable
          key={e.id}
          testID={`exercise-${e.id}`}
          accessibilityRole="button"
          accessibilityLabel={e.name.en}
          onPress={() => router.push(`/exercise/${e.id}`)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? p.surfaceRaised : p.surface,
            borderColor: p.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: spacing.md,
            gap: 6,
          })}
        >
          <Row gap={spacing.sm}>
            <Text style={{ fontFamily: fonts.displaySemi, fontSize: 20, color: p.text, textTransform: 'uppercase', flex: 1 }}>{e.name.en}</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 18, color: p.accentInk }}>›</Text>
          </Row>
          <Small>
            {t.dyn(`pattern.${e.pattern}`)} · {e.primaryMuscles.map((m) => t.dyn(`muscle.${m}`)).join(', ')}
          </Small>
          <Row gap={spacing.sm} wrap>
            <Pill label={t.dyn(`learn.difficulty_${e.skill}`)} />
            {e.equipment.length === 0 && <Pill label={t('exercise.noEquipment')} />}
            {snapshot?.familiarity[e.id] && <Pill label={t.dyn(`familiarity.${snapshot.familiarity[e.id]}`)} tone="accent" />}
          </Row>
        </Pressable>
      ))}
      <Small>{t('common.devContent')}</Small>
    </Screen>
  );
}
