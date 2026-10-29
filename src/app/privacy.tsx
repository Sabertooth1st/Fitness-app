import { Stack } from 'expo-router';
import { Body, Card, Pill, Screen } from '../components/ui';
import { useT } from '../i18n';

export default function Privacy() {
  const t = useT();
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: t('privacy.title') }} />
      <Card>
        <Body>{t('privacy.body')}</Body>
      </Card>
      <Pill label={t('privacy.draftNote')} tone="warning" />
    </Screen>
  );
}
