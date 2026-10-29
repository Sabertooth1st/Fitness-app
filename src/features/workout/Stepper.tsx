import { Pressable, Text, TextInput, View } from 'react-native';
import { MIN_TOUCH, radius, spacing } from '../../theme/tokens';
import { usePalette } from '../app/AppState';

/** Large +/- number input; also accepts typed values. */
export function Stepper({
  label,
  value,
  onChange,
  step,
  suffix,
  placeholder,
  testID,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step: number;
  suffix?: string;
  placeholder?: string;
  testID?: string;
}) {
  const p = usePalette();
  const btn = (delta: number, symbol: string, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a11y} ${label}`}
      onPress={() => onChange(Math.max(0, Math.round(((value ?? 0) + delta) * 100) / 100))}
      style={{
        width: MIN_TOUCH + 8,
        height: MIN_TOUCH + 8,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: p.border,
        backgroundColor: p.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: '700', color: p.text }}>{symbol}</Text>
    </Pressable>
  );
  return (
    <View style={{ alignSelf: 'stretch', gap: spacing.xs }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: p.textMuted }}>
        {label}
        {suffix ? ` (${suffix})` : ''}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        {btn(-step, '−', 'Decrease')}
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          keyboardType="decimal-pad"
          value={value === null ? '' : String(value)}
          placeholder={placeholder}
          placeholderTextColor={p.textMuted}
          onChangeText={(s) => {
            if (s.trim() === '') return onChange(null);
            const n = Number(s.replace(',', '.'));
            if (Number.isFinite(n) && n >= 0 && n <= 1000) onChange(n);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            width: '100%',
            minHeight: MIN_TOUCH + 8,
            textAlign: 'center',
            fontSize: 22,
            fontWeight: '700',
            color: p.text,
            borderWidth: 1,
            borderColor: p.border,
            borderRadius: radius.md,
            backgroundColor: p.surface,
          }}
        />
        {btn(step, '+', 'Increase')}
      </View>
    </View>
  );
}
