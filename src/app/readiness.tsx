import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Card, Choice, Heading, Row, Screen, Title } from '../components/ui';
import { decideSession, type CoachDecision } from '../domain/coach';
import { COACH_RULES, XP_RULES } from '../domain/rules';
import { nextSessionKey } from '../domain/schedule';
import type { ReadinessFeeling, SafetyAnswer } from '../domain/types';
import { ActiveSessionExistsError } from '../data/local/store';
import { catalogue, coachInputFrom, useApp } from '../features/app/AppState';
import { useT } from '../i18n';
import { reasonText } from '../i18n/format';
import { spacing } from '../theme/tokens';

const TIMES = [15, 20, 30, 45, 60];
const FEELINGS: ReadinessFeeling[] = ['comfortable', 'unsure', 'returning'];

export default function Readiness() {
  const t = useT();
  const { method } = useLocalSearchParams<{ method?: string }>();
  const checkInMethod = method === 'location_assisted' ? 'location_assisted' : 'manual';
  const { snapshot, store, refresh, today, timezone } = useApp();
  const programme = snapshot?.programme;
  const [minutes, setMinutes] = useState(programme?.sessionMinutes ?? 45);
  const [feeling, setFeeling] = useState<ReadinessFeeling>(
    snapshot?.profile?.experience === 'returning' && snapshot.history.length === 0 ? 'returning' : 'comfortable',
  );
  const [safety, setSafety] = useState<SafetyAnswer | null>(null);
  const [blocked, setBlocked] = useState<CoachDecision | null>(null);
  const [busy, setBusy] = useState(false);
  if (!snapshot || !programme) return null;

  async function start() {
    if (!snapshot || !programme || safety === null) return;
    setBusy(true);
    try {
      const date = today();
      const input = coachInputFrom(snapshot, date, { availableMinutes: minutes, feeling, safety })!;
      const decision = decideSession(input);
      if (decision.kind === 'safety_stop') {
        await store.recordSafetyStop({
          localDate: date,
          timezone,
          checkInMethod,
          sessionKey: nextSessionKey(input.template.rotation, snapshot.history),
          templateId: input.template.id,
          templateVersion: input.template.version,
          rulesVersion: COACH_RULES.version,
        });
        await refresh();
        router.replace('/safety');
        return;
      }
      if (decision.kind !== 'train') {
        setBlocked(decision);
        return;
      }
      const sessionId = await store.startSession({ decision, catalogue, localDate: date, timezone, checkInMethod, rulesVersion: COACH_RULES.version });
      await store.award({ type: 'check_in', localDate: date, sessionId, isTrainingDay: true }, { daysPerWeek: programme.daysPerWeek, rules: XP_RULES });
      await refresh();
      router.replace('/workout');
    } catch (e) {
      if (e instanceof ActiveSessionExistsError) {
        await refresh();
        router.replace('/workout');
        return;
      }
      throw e;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Title>{t('readiness.title')}</Title>

      <Heading>{t('readiness.safetyQuestion')}</Heading>
      <Row gap={spacing.sm}>
        <Choice testID="safety-no" label={t('readiness.safetyNo')} selected={safety === 'ok'} onPress={() => setSafety('ok')} />
        <Choice testID="safety-yes" label={t('readiness.safetyYes')} selected={safety === 'concern'} onPress={() => setSafety('concern')} />
      </Row>

      <Heading>{t('readiness.timeQuestion')}</Heading>
      <Row gap={spacing.sm} wrap>
        {TIMES.map((m) => (
          <Choice key={m} label={t('common.minutes', { n: m })} selected={minutes === m} onPress={() => setMinutes(m)} />
        ))}
      </Row>

      <Heading>{t('readiness.feelingQuestion')}</Heading>
      {FEELINGS.map((f) => (
        <Choice key={f} label={t.dyn(`readiness.feeling_${f}`)} selected={feeling === f} onPress={() => setFeeling(f)} />
      ))}

      {blocked && blocked.kind !== 'train' && (
        <Card tone="warning">
          <Body>{t('noSession.body')}</Body>
          {blocked.reasons.map((r, i) => (
            <Body key={i} muted>• {reasonText(t.locale, r)}</Body>
          ))}
          <Button variant="secondary" label={t('noSession.rest')} onPress={() => router.replace('/(tabs)')} />
        </Card>
      )}

      <Button testID="start-session" label={t('readiness.start')} disabled={safety === null || busy} onPress={start} />
    </Screen>
  );
}
