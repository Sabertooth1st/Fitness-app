import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '../features/app/AppState';
import { MIN_TOUCH, radius, spacing } from '../theme/tokens';

export function Screen({ children, scroll = true, edges }: { children: ReactNode; scroll?: boolean; edges?: ('top' | 'bottom')[] }) {
  const p = usePalette();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.background }} edges={edges ?? ['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screen, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const p = usePalette();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: p.text }]}>
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const p = usePalette();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: p.text }]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, center }: { children: ReactNode; muted?: boolean; center?: boolean }) {
  const p = usePalette();
  return <Text style={[styles.body, { color: muted ? p.textMuted : p.text, textAlign: center ? 'center' : 'left' }]}>{children}</Text>;
}

export function Card({ children, style, tone = 'surface' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'surface' | 'accent' | 'warning' | 'danger' }) {
  const p = usePalette();
  const bg = { surface: p.surface, accent: p.accentSoft, warning: p.warningSoft, danger: p.dangerSoft }[tone];
  return <View style={[styles.card, { backgroundColor: bg, borderColor: p.border }, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  hint,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  hint?: string;
  testID?: string;
}) {
  const p = usePalette();
  const colors: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: p.accent, fg: p.onAccent, border: p.accent },
    secondary: { bg: p.surface, fg: p.text, border: p.border },
    danger: { bg: p.danger, fg: p.onDanger, border: p.danger },
    ghost: { bg: 'transparent', fg: p.accent, border: 'transparent' },
  };
  const c = colors[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: c.bg, borderColor: c.border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: c.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Selectable option. Selection is shown with a text mark and border, never colour alone. */
export function Choice({
  label,
  selected,
  onPress,
  description,
  multi,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  description?: string;
  multi?: boolean;
  testID?: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      onPress={onPress}
      style={[
        styles.choice,
        { borderColor: selected ? p.accent : p.border, backgroundColor: selected ? p.accentSoft : p.surface, borderWidth: selected ? 2 : 1 },
      ]}
    >
      <Text style={[styles.choiceMark, { color: selected ? p.onAccentSoft : p.textMuted }]}>{selected ? '✓' : multi ? '○' : '○'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.body, { color: selected ? p.onAccentSoft : p.text, fontWeight: selected ? '600' : '400' }]}>{label}</Text>
        {description ? <Text style={[styles.small, { color: p.textMuted }]}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Pill({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'accent' | 'warning' }) {
  const p = usePalette();
  const bg = { muted: p.surfaceMuted, accent: p.accentSoft, warning: p.warningSoft }[tone];
  const fg = { muted: p.textMuted, accent: p.onAccentSoft, warning: p.onWarningSoft }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.small, { color: fg, fontWeight: '600', flexShrink: 1 }]}>{label}</Text>
    </View>
  );
}

export function Row({ children, gap = spacing.sm, wrap }: { children: ReactNode; gap?: number; wrap?: boolean }) {
  return <View style={{ flexDirection: 'row', gap, flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: 'center' }}>{children}</View>;
}

export function Gap({ size = spacing.md }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function BulletList({ items }: { items: string[] }) {
  const p = usePalette();
  return (
    <View style={{ gap: spacing.xs }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Text style={[styles.body, { color: p.textMuted }]}>{i + 1}.</Text>
          <Text style={[styles.body, { color: p.text, flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 19, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 14, lineHeight: 19 },
  card: { borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.sm },
  button: {
    minHeight: MIN_TOUCH + 6,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  choice: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  choiceMark: { fontSize: 18, width: 22, textAlign: 'center', fontWeight: '700' },
  pill: { borderRadius: radius.lg, paddingHorizontal: spacing.sm + 2, paddingVertical: 4, alignSelf: 'flex-start', maxWidth: '100%' },
});
