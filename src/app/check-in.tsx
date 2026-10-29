import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Body, Button, Card, Heading, Screen, Title } from '../components/ui';
import type { ProximityResult } from '../domain/checkIn';
import { CHECK_IN_RULES } from '../domain/rules';
import { useApp } from '../features/app/AppState';
import { checkProximity } from '../features/check-in/location';
import { useT } from '../i18n';

type Phase = { kind: 'choose' } | { kind: 'explain' } | { kind: 'checking' } | { kind: 'result'; result: ProximityResult };

/**
 * Manual check-in is always available and gives equal workout access.
 * Location is optional, foreground-only and evaluated on the device.
 */
export default function CheckIn() {
  const t = useT();
  const { snapshot, palette } = useApp();
  const [phase, setPhase] = useState<Phase>({ kind: 'choose' });
  const gym = snapshot?.gym?.label ?? t('onboarding.gymLabelPlaceholder');

  const proceed = (method: 'manual' | 'location_assisted') => router.replace({ pathname: '/readiness', params: { method } });

  async function runLocation() {
    setPhase({ kind: 'checking' });
    const result = await checkProximity(snapshot?.gym?.pin ?? null, CHECK_IN_RULES);
    setPhase({ kind: 'result', result });
  }

  const manual = <Button testID="manual-check-in" label={t('checkIn.manual')} onPress={() => proceed('manual')} />;

  return (
    <Screen edges={['bottom']}>
      <Title>{t('checkIn.title')}</Title>
      <Body>{t('checkIn.body', { gym })}</Body>

      {phase.kind === 'choose' && (
        <>
          {manual}
          <Body muted>{t('checkIn.manualNote')}</Body>
          <Button testID="location-check-in" variant="secondary" label={t('checkIn.location')} onPress={() => setPhase({ kind: 'explain' })} />
          <Body muted>{t('checkIn.locationNote')}</Body>
        </>
      )}

      {phase.kind === 'explain' && (
        <Card>
          <Body>{t('checkIn.locationExplain')}</Body>
          <Button label={t('common.continue')} onPress={runLocation} />
          {manual}
        </Card>
      )}

      {phase.kind === 'checking' && (
        <Card>
          <ActivityIndicator color={palette.accent} />
          <Body>{t('checkIn.checking')}</Body>
          {manual}
        </Card>
      )}

      {phase.kind === 'result' && phase.result.status === 'near' && (
        <Card tone="accent">
          <Heading>{t('checkIn.near', { gym })}</Heading>
          <Button testID="location-continue" label={t('common.continue')} onPress={() => proceed('location_assisted')} />
        </Card>
      )}

      {phase.kind === 'result' && phase.result.status !== 'near' && (
        <Card tone="warning">
          <Body>
            {phase.result.status === 'far' ? t('checkIn.far', { gym }) : t.dyn(`checkIn.uncertain_${phase.result.reason}`)}
          </Body>
          {manual}
        </Card>
      )}

      <Body muted>{t('checkIn.honesty')}</Body>
    </Screen>
  );
}
