import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Body, Button, Card, Choice, Heading, Screen, Title } from '../components/ui';
import { usePalette } from '../features/app/AppState';
import { useT } from '../i18n';

export default function Welcome() {
  const t = useT();
  const p = usePalette();
  const [adult, setAdult] = useState(false);
  return (
    <Screen>
      <Title>{t('welcome.title')}</Title>
      <Text style={{ fontSize: 22, fontWeight: '600', color: p.accent }}>{t('welcome.tagline')}</Text>
      <Body>{t('welcome.body')}</Body>
      <Card>
        <Heading>{t('welcome.scopeTitle')}</Heading>
        <Body>{t('welcome.scope')}</Body>
      </Card>
      <Card tone="warning">
        <Body>{t('welcome.healthNote')}</Body>
      </Card>
      <Choice testID="adult-confirm" multi label={t('welcome.adultConfirm')} selected={adult} onPress={() => setAdult((a) => !a)} />
      <Button testID="start-guest" label={t('welcome.start')} disabled={!adult} onPress={() => router.push('/onboarding')} />
      <Body muted>{t('welcome.guestNote')}</Body>
    </Screen>
  );
}
