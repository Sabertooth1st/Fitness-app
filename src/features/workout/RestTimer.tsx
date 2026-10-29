import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Button, Card } from '../../components/ui';
import { useT } from '../../i18n';
import { usePalette } from '../app/AppState';

function format(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Displays time left until a persisted deadline. The interval only refreshes
 * the display; correctness comes from the stored deadline, so backgrounding or
 * app termination does not break the timer.
 */
export function RestTimer({ deadline, onSkip }: { deadline: number; onSkip: () => void }) {
  const t = useT();
  const p = usePalette();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = deadline - now;
  return (
    <Card tone="accent">
      {remaining > 0 ? (
        <>
          <Text
            accessibilityLiveRegion="polite"
            accessibilityLabel={t('workout.restRemaining', { time: format(remaining) })}
            style={{ fontSize: 34, fontWeight: '700', color: p.onAccentSoft, fontVariant: ['tabular-nums'] }}
          >
            {format(remaining)}
          </Text>
          <Button variant="secondary" label={t('workout.skipRest')} onPress={onSkip} />
        </>
      ) : (
        <Text accessibilityLiveRegion="polite" style={{ fontSize: 17, fontWeight: '600', color: p.onAccentSoft }}>
          {t('workout.restDone')}
        </Text>
      )}
    </Card>
  );
}
