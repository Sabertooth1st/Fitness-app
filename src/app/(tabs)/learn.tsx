import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput } from 'react-native';
import { Body, Choice, Heading, Pill, Row, Screen, Title } from '../../components/ui';
import { DEV_EXERCISES } from '../../content/exercises.dev';
import { ALL_EQUIPMENT, type Equipment, type Muscle } from '../../domain/types';
import { useApp } from '../../features/app/AppState';
import { useT } from '../../i18n';
import { radius, spacing } from '../../theme/tokens';

const MUSCLES: Muscle[] = ['chest', 'upper_back', 'lats', 'front_shoulders', 'quadriceps', 'hamstrings', 'glutes', 'abdominals'];

export default function Learn() {
  const t = useT();
  const { palette, snapshot } = useApp();
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [skill, setSkill] = useState<1 | 2 | 3 | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEV_EXERCISES.filter((e) => e.reviewStatus !== 'rejected')
      .filter((e) => !q || e.name.en.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)))
      .filter((e) => !equipment || e.equipment.includes(equipment))
      .filter((e) => !muscle || e.primaryMuscles.includes(muscle) || e.secondaryMuscles.includes(muscle))
      .filter((e) => !skill || e.skill === skill);
  }, [query, equipment, muscle, skill]);

  const chipRow = <T,>(items: (T | null)[], value: T | null, set: (v: T | null) => void, label: (v: T | null) => string) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {items.map((v, i) => (
        <Choice key={i} label={label(v)} selected={value === v} onPress={() => set(v)} />
      ))}
    </ScrollView>
  );

  return (
    <Screen>
      <Title>{t('learn.title')}</Title>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('learn.search')}
        placeholderTextColor={palette.textMuted}
        accessibilityLabel={t('learn.search')}
        style={{ minHeight: 50, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: palette.text, backgroundColor: palette.surface, fontSize: 16 }}
      />
      <Body muted>{t('learn.filterEquipment')}</Body>
      {chipRow<Equipment>([null, ...ALL_EQUIPMENT], equipment, setEquipment, (v) => (v ? t.dyn(`equipment.${v}`) : t('learn.any')))}
      <Body muted>{t('learn.filterMuscle')}</Body>
      {chipRow<Muscle>([null, ...MUSCLES], muscle, setMuscle, (v) => (v ? t.dyn(`muscle.${v}`) : t('learn.any')))}
      <Body muted>{t('learn.filterDifficulty')}</Body>
      {chipRow<1 | 2 | 3>([null, 1, 2, 3], skill, setSkill, (v) => (v ? t.dyn(`learn.difficulty_${v}`) : t('learn.any')))}
      <Body muted>{t('learn.count', { n: results.length })}</Body>
      {results.length === 0 && <Body>{t('learn.empty')}</Body>}
      {results.map((e) => (
        <Pressable
          key={e.id}
          accessibilityRole="button"
          accessibilityLabel={e.name.en}
          onPress={() => router.push(`/exercise/${e.id}`)}
          style={{ backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs }}
        >
          <Heading>{e.name.en}</Heading>
          <Body muted>{e.primaryMuscles.map((m) => t.dyn(`muscle.${m}`)).join(', ')}</Body>
          <Row gap={spacing.sm} wrap>
            <Pill label={t.dyn(`learn.difficulty_${e.skill}`)} />
            {snapshot?.familiarity[e.id] && <Pill label={t.dyn(`familiarity.${snapshot.familiarity[e.id]}`)} tone="accent" />}
            {e.reviewStatus !== 'approved' && <Pill label={t('common.devContent')} tone="warning" />}
          </Row>
        </Pressable>
      ))}
    </Screen>
  );
}
