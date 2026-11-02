import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { FlameIcon } from '../components/icons';
import { Body, Button, Card, Choice, Eyebrow, Screen, Small, Title } from '../components/ui';
import { HARD_DAY_REASONS, hardDayPlan, type HardDayReason } from '../domain/motivation';
import { usePalette } from '../features/app/AppState';
import { useT } from '../i18n';
import { spacing } from '../theme/tokens';

/**
 * The "don't skip, shrink it" flow. The plan is always smaller, never harder,
 * and the safety question still comes before any exercise.
 */
export default function HardDay() {
  const t = useT();
  const p = usePalette();
  const [reason, setReason] = useState<HardDayReason | null>(null);
  const plan = reason ? hardDayPlan(reason) : null;

  return (
    <Screen edges={['bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <FlameIcon color={p.accentInk} size={28} />
        <Eyebrow tone="accent">{t('hardDay.title')}</Eyebrow>
      </View>
      <Title>{t('hardDay.question')}</Title>
      {HARD_DAY_REASONS.map((r) => (
        <Choice key={r} testID={`hard-${r}`} label={t.dyn(`hardDay.reason_${r}`)} selected={reason === r} onPress={() => setReason(r)} />
      ))}
      {plan && reason && (
        <Card tone="accent">
          <Body bold>{t.dyn(`hardDay.plan_${plan.commitment}`)}</Body>
          {reason === 'sore' && <Small muted={false}>{t('hardDay.sore_note')}</Small>}
        </Card>
      )}
      <Button
        testID="hard-day-go"
        size="large"
        label={t('hardDay.go')}
        disabled={!plan}
        onPress={() =>
          router.replace({ pathname: '/check-in', params: { hardDay: '1', minutes: String(plan!.minutes), commitment: plan!.commitment } })
        }
      />
    </Screen>
  );
}
