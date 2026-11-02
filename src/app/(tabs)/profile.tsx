import Constants from 'expo-constants';
import { router } from 'expo-router';
import { View } from 'react-native';
import { confirmAction } from '../../components/confirm';
import { Body, Button, Card, Choice, Eyebrow, Row, Screen, Small, Title } from '../../components/ui';
import { addDays } from '../../domain/dates';
import { cloudConfigured, env } from '../../config/env';
import { wipeLocalData } from '../../data/local/db';
import { useDb } from '../../data/local/DbProvider';
import type { Profile } from '../../data/local/models';
import { useApp } from '../../features/app/AppState';
import { exportJson } from '../../features/settings/dataExport';
import { cancelReminders, scheduleReminders } from '../../features/settings/reminders';
import { useT } from '../../i18n';
import { spacing } from '../../theme/tokens';

export default function ProfileScreen() {
  const t = useT();
  const db = useDb();
  const { store, snapshot, refresh, today } = useApp();
  if (!snapshot?.profile || !snapshot.programme) return null;
  const profile = snapshot.profile;
  const programme = snapshot.programme;

  const update = async (patch: Partial<Profile>) => {
    await store.setProfile({ ...profile, ...patch });
    await refresh();
  };

  return (
    <Screen>
      <Title>{t('profile.title')}</Title>

      <Button variant="secondary" label={t('profile.schedule')} onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })} />
      <Button variant="secondary" label={t('profile.gym')} onPress={() => router.push('/gym')} />

      <Card>
        <Eyebrow tone="accent">{programme.pause ? t('today.pausedTitle') : t('profile.pause')}</Eyebrow>
        <Small>{t('profile.pauseNote')}</Small>
        {programme.pause ? (
          <Button
            label={t('profile.resume')}
            onPress={async () => {
              await store.setProgramme({ ...programme, pause: null });
              await refresh();
            }}
          />
        ) : (
          <Row gap={spacing.sm} wrap>
            {[7, 14].map((d) => (
              <Button
                key={d}
                variant="secondary"
                label={t('profile.pauseDays', { n: d })}
                onPress={async () => {
                  await store.setProgramme({ ...programme, pause: { from: today(), until: addDays(today(), d - 1) } });
                  await refresh();
                }}
              />
            ))}
          </Row>
        )}
      </Card>

      <Card>
        <Eyebrow tone="accent">{t('profile.units')}</Eyebrow>
        <Row gap={spacing.sm}>
          <View style={{ flex: 1 }}>
            <Choice label="kg" selected={profile.units === 'kg'} onPress={() => update({ units: 'kg' })} />
          </View>
          <View style={{ flex: 1 }}>
            <Choice label="lb" selected={profile.units === 'lb'} onPress={() => update({ units: 'lb' })} />
          </View>
        </Row>
      </Card>

      <Card>
        <Eyebrow tone="accent">{t('profile.theme')}</Eyebrow>
        {(['system', 'light', 'dark'] as const).map((th) => (
          <Choice key={th} label={t.dyn(`profile.theme_${th}`)} selected={profile.theme === th} onPress={() => update({ theme: th })} />
        ))}
        <Choice
          multi
          label={t('profile.reducedMotion')}
          description={t('profile.reducedMotionNote')}
          selected={profile.reducedMotion === 'on'}
          onPress={() => update({ reducedMotion: profile.reducedMotion === 'on' ? 'system' : 'on' })}
        />
      </Card>

      <Card>
        <Eyebrow tone="accent">{t('profile.reminders')}</Eyebrow>
        <Small>{t('profile.remindersNote')}</Small>
        <Choice
          multi
          label={t('profile.reminders')}
          selected={false}
          onPress={async () => {
            const r = await store.getReminders();
            if (r.enabled) {
              await cancelReminders();
              await store.setReminders({ ...r, enabled: false });
            } else {
              const ok = await scheduleReminders(programme.preferredWeekdays, r.hour, r.minute, {
                title: 'ARRIVE',
                body: t('today.trainingTitle'),
              });
              await store.setReminders({ ...r, enabled: ok });
            }
            await refresh();
          }}
        />
      </Card>

      <Card>
        <Eyebrow tone="accent">{t('profile.language')}</Eyebrow>
        <Choice label="English" selected={profile.locale === 'en'} onPress={() => update({ locale: 'en' })} />
        {env.appEnv === 'development' && (
          <Choice label={t('profile.languageDraft')} selected={profile.locale === 'de-CH'} onPress={() => update({ locale: 'de-CH' })} />
        )}
      </Card>

      <Card>
        <Eyebrow tone="accent">{t('profile.account')}</Eyebrow>
        <Body>{t('profile.accountGuest')}</Body>
        {!cloudConfigured && <Small>{t('profile.accountNotConfigured')}</Small>}
      </Card>

      <Button variant="secondary" label={t('profile.export')} onPress={() => void exportJson(store)} />
      <Button variant="secondary" label={t('profile.privacy')} onPress={() => router.push('/privacy')} />
      <Button
        variant="danger"
        label={t('profile.deleteLocal')}
        onPress={() =>
          confirmAction({
            title: t('profile.deleteLocal'),
            message: t('profile.deleteConfirm'),
            confirm: t('profile.deleteLocal'),
            cancel: t('common.cancel'),
            destructive: true,
            onConfirm: async () => {
              await cancelReminders();
              await wipeLocalData(db);
              await refresh();
              router.replace('/welcome');
            },
          })
        }
      />
      <Small>{t('profile.version', { v: Constants.expoConfig?.version ?? '?', env: env.appEnv })}</Small>
    </Screen>
  );
}
