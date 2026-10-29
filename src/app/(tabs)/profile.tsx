import Constants from 'expo-constants';
import { router } from 'expo-router';
import { confirmAction } from '../../components/confirm';
import { Body, Button, Card, Choice, Heading, Row, Screen, Title } from '../../components/ui';
import { addDays } from '../../domain/dates';
import { cloudConfigured, env } from '../../config/env';
import { wipeLocalData, type Db } from '../../data/local/db';
import type { Profile } from '../../data/local/models';
import { useApp } from '../../features/app/AppState';
import { exportJson } from '../../features/settings/dataExport';
import { cancelReminders, scheduleReminders } from '../../features/settings/reminders';
import { useT } from '../../i18n';
import { spacing } from '../../theme/tokens';
import { useSQLiteContext } from 'expo-sqlite';

export default function ProfileScreen() {
  const t = useT();
  const db = useSQLiteContext();
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
        <Heading>{programme.pause ? t('today.pausedTitle') : t('profile.pause')}</Heading>
        <Body muted>{t('profile.pauseNote')}</Body>
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
                label={`${d} days`}
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
        <Heading>{t('profile.units')}</Heading>
        <Row gap={spacing.sm}>
          <Choice label="kg" selected={profile.units === 'kg'} onPress={() => update({ units: 'kg' })} />
          <Choice label="lb" selected={profile.units === 'lb'} onPress={() => update({ units: 'lb' })} />
        </Row>
      </Card>

      <Card>
        <Heading>{t('profile.theme')}</Heading>
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
        <Heading>{t('profile.reminders')}</Heading>
        <Body muted>{t('profile.remindersNote')}</Body>
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
        <Heading>{t('profile.language')}</Heading>
        <Choice label="English" selected={profile.locale === 'en'} onPress={() => update({ locale: 'en' })} />
        {env.appEnv === 'development' && (
          <Choice label={t('profile.languageDraft')} selected={profile.locale === 'de-CH'} onPress={() => update({ locale: 'de-CH' })} />
        )}
      </Card>

      <Card>
        <Heading>{t('profile.account')}</Heading>
        <Body>{t('profile.accountGuest')}</Body>
        {!cloudConfigured && <Body muted>{t('profile.accountNotConfigured')}</Body>}
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
              await wipeLocalData(db as unknown as Db);
              await refresh();
              router.replace('/welcome');
            },
          })
        }
      />
      <Body muted>{t('profile.version', { v: Constants.expoConfig?.version ?? '?', env: env.appEnv })}</Body>
    </Screen>
  );
}
