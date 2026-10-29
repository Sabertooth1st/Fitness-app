import { Stack } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { Body, Button, Card, Choice, Heading, Screen } from '../components/ui';
import { CHECK_IN_RULES } from '../domain/rules';
import { ALL_EQUIPMENT, type Equipment } from '../domain/types';
import { useApp } from '../features/app/AppState';
import { ensureForegroundPermission, readPosition } from '../features/check-in/location';
import { useT } from '../i18n';
import { radius, spacing } from '../theme/tokens';

export default function Gym() {
  const t = useT();
  const { store, snapshot, refresh, palette } = useApp();
  const gym = snapshot?.gym ?? { label: '', equipment: [...ALL_EQUIPMENT], pin: null };
  const [label, setLabel] = useState(gym.label);
  const [message, setMessage] = useState<string | null>(null);

  const save = async (patch: Partial<typeof gym>) => {
    await store.setGym({ ...gym, label: label.trim() || gym.label, ...patch });
    await refresh();
  };
  const toggle = (e: Equipment) => save({ equipment: gym.equipment.includes(e) ? gym.equipment.filter((x) => x !== e) : [...gym.equipment, e] });

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: t('gym.title') }} />
      <Heading>{t('gym.label')}</Heading>
      <TextInput
        value={label}
        onChangeText={setLabel}
        onBlur={() => void save({})}
        accessibilityLabel={t('gym.label')}
        style={{ minHeight: 50, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: palette.text, backgroundColor: palette.surface, fontSize: 16 }}
      />
      <Heading>{t('gym.equipment')}</Heading>
      {ALL_EQUIPMENT.map((e) => (
        <Choice key={e} multi label={t.dyn(`equipment.${e}`)} selected={gym.equipment.includes(e)} onPress={() => toggle(e)} />
      ))}
      <Card>
        <Heading>{t('gym.pinTitle')}</Heading>
        <Body>{t('gym.pinBody')}</Body>
        <Button
          variant="secondary"
          label={t('gym.pinSave')}
          onPress={async () => {
            setMessage(null);
            if (!(await ensureForegroundPermission())) return setMessage(t('checkIn.uncertain_permission_denied'));
            const s = await readPosition(CHECK_IN_RULES.timeoutMs);
            if (!s || s === 'timeout' || s.accuracy === null || s.accuracy > CHECK_IN_RULES.maxAccuracyMeters) return setMessage(t('gym.pinFailed'));
            await save({ pin: { latitude: s.latitude, longitude: s.longitude } });
            setMessage(t('gym.pinSaved'));
          }}
        />
        {gym.pin && <Button variant="ghost" label={t('gym.pinRemove')} onPress={() => save({ pin: null })} />}
        {message && <Body>{message}</Body>}
      </Card>
    </Screen>
  );
}
