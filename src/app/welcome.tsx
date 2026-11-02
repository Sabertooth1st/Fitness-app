import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Button, Card, Choice, Display, Eyebrow, Screen, Small } from '../components/ui';
import { usePalette } from '../features/app/AppState';
import { useT } from '../i18n';
import { fonts, spacing } from '../theme/tokens';

export default function Welcome() {
  const t = useT();
  const p = usePalette();
  const [adult, setAdult] = useState(false);
  const points = [t('welcome.point1'), t('welcome.point2'), t('welcome.point3')];
  return (
    <Screen>
      <View style={{ gap: spacing.sm, paddingTop: spacing.lg }}>
        <Eyebrow tone="accent">{t('welcome.title')}</Eyebrow>
        <Display>{t('welcome.tagline')}</Display>
        <View style={{ height: 6, width: 72, backgroundColor: p.accent, borderRadius: 2 }} />
      </View>
      <Body>{t('welcome.body')}</Body>
      <View style={{ gap: spacing.sm }}>
        {points.map((pt) => (
          <View key={pt} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: p.accentInk }}>/</Text>
            <Body bold>{pt}</Body>
          </View>
        ))}
      </View>
      <Card>
        <Eyebrow>{t('welcome.scopeTitle')}</Eyebrow>
        <Small>{t('welcome.scope')}</Small>
      </Card>
      <Card tone="warning">
        <Small muted={false}>{t('welcome.healthNote')}</Small>
      </Card>
      <Choice testID="adult-confirm" multi label={t('welcome.adultConfirm')} selected={adult} onPress={() => setAdult((a) => !a)} />
      <Button testID="start-guest" size="large" label={t('welcome.start')} disabled={!adult} onPress={() => router.push('/onboarding')} />
      <Small>{t('welcome.guestNote')}</Small>
    </Screen>
  );
}
