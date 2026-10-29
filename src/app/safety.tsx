import { router } from 'expo-router';
import { Body, Button, Card, Pill, Screen, Title } from '../components/ui';
import { useT } from '../i18n';

/**
 * Safety stop. Outranks every habit and completion goal: no exercise
 * suggestion, no "train something else", no XP messaging.
 */
export default function Safety() {
  const t = useT();
  return (
    <Screen>
      <Title>{t('safety.title')}</Title>
      <Card tone="danger">
        <Body>{t('safety.body')}</Body>
      </Card>
      <Card tone="danger">
        <Body>{t('safety.emergency')}</Body>
      </Card>
      <Body>{t('safety.followUp')}</Body>
      <Body muted>{t('safety.noPenalty')}</Body>
      <Pill label={t('safety.reviewNote')} tone="warning" />
      <Button testID="safety-back" variant="secondary" label={t('safety.back')} onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}
