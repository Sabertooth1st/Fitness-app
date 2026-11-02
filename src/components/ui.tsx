import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '../features/app/AppState';
import { fonts, MIN_TOUCH, radius, spacing } from '../theme/tokens';

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

/** Small uppercase label above a heading or value. */
export function Eyebrow({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' }) {
  const p = usePalette();
  return <Text style={[styles.eyebrow, { color: tone === 'accent' ? p.accentInk : p.textMuted }]}>{children}</Text>;
}

/** Screen title in the condensed display face. */
export function Title({ children }: { children: ReactNode }) {
  const p = usePalette();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: p.text }]}>
      {children}
    </Text>
  );
}

/** Oversized display line for the one thing that matters on a screen. */
export function Display({ children, tone = 'text' }: { children: ReactNode; tone?: 'text' | 'accent' }) {
  const p = usePalette();
  return (
    <Text accessibilityRole="header" style={[styles.display, { color: tone === 'accent' ? p.accentInk : p.text }]}>
      {children}
    </Text>
  );
}

export function Heading({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: p.text }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, center, bold }: { children: ReactNode; muted?: boolean; center?: boolean; bold?: boolean }) {
  const p = usePalette();
  return (
    <Text
      style={[
        styles.body,
        { color: muted ? p.textMuted : p.text, textAlign: center ? 'center' : 'left', fontFamily: bold ? fonts.bodyBold : fonts.body },
      ]}
    >
      {children}
    </Text>
  );
}

export function Small({ children, muted = true }: { children: ReactNode; muted?: boolean }) {
  const p = usePalette();
  return <Text style={[styles.small, { color: muted ? p.textMuted : p.text }]}>{children}</Text>;
}

export function Card({
  children,
  style,
  tone = 'surface',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'surface' | 'accent' | 'warning' | 'danger' | 'raised';
}) {
  const p = usePalette();
  const bg = { surface: p.surface, raised: p.surfaceRaised, accent: p.accentSoft, warning: p.warningSoft, danger: p.dangerSoft }[tone];
  const border = tone === 'accent' ? p.accent : tone === 'danger' ? p.danger : p.border;
  return <View style={[styles.card, { backgroundColor: bg, borderColor: border }, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  hint,
  testID,
  size = 'normal',
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  hint?: string;
  testID?: string;
  size?: 'normal' | 'large';
}) {
  const p = usePalette();
  const colors: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: p.accent, fg: p.onAccent, border: p.accent },
    secondary: { bg: p.surfaceRaised, fg: p.text, border: p.border },
    danger: { bg: p.danger, fg: p.onDanger, border: p.danger },
    ghost: { bg: 'transparent', fg: p.accentInk, border: 'transparent' },
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
        size === 'large' && styles.buttonLarge,
        { backgroundColor: c.bg, borderColor: c.border, opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <Text style={[styles.buttonText, size === 'large' && styles.buttonTextLarge, { color: c.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Selectable option. Selection is shown with a mark and a border, never colour alone. */
export function Choice({
  label,
  selected,
  onPress,
  description,
  multi,
  testID,
  compact,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  description?: string;
  multi?: boolean;
  testID?: string;
  compact?: boolean;
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
        compact && styles.choiceCompact,
        { borderColor: selected ? p.accent : p.border, backgroundColor: selected ? p.accentSoft : p.surface, borderWidth: selected ? 2 : 1 },
      ]}
    >
      <View
        style={[
          multi ? styles.markSquare : styles.markRound,
          { borderColor: selected ? p.accent : p.textMuted, backgroundColor: selected ? p.accent : 'transparent' },
        ]}
      >
        {selected ? <Text style={[styles.markText, { color: p.onAccent }]}>✓</Text> : null}
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={[styles.body, { color: selected ? p.onAccentSoft : p.text, fontFamily: selected ? fonts.bodyBold : fonts.body }]}>{label}</Text>
        {description ? <Text style={[styles.small, { color: p.textMuted }]}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Pill({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'accent' | 'warning' | 'solid' }) {
  const p = usePalette();
  const bg = { muted: p.surfaceMuted, accent: p.accentSoft, warning: p.warningSoft, solid: p.accent }[tone];
  const fg = { muted: p.textMuted, accent: p.onAccentSoft, warning: p.onWarningSoft, solid: p.onAccent }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Week target as blocks: filled blocks are sessions done. Includes a text equivalent. */
export function Segments({ done, target, label }: { done: number; target: number; label: string }) {
  const p = usePalette();
  return (
    <View accessible accessibilityLabel={label} style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {Array.from({ length: target }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 10,
              borderRadius: 3,
              backgroundColor: i < done ? p.accent : p.surfaceMuted,
              borderWidth: i < done ? 0 : 1,
              borderColor: p.border,
            }}
          />
        ))}
      </View>
      <Text style={[styles.small, { color: p.textMuted }]}>{label}</Text>
    </View>
  );
}

/** A figure with its label. */
export function Stat({ value, label, testID }: { value: string | number; label: string; testID?: string }) {
  const p = usePalette();
  return (
    <View testID={testID} style={[styles.stat, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Text style={[styles.statValue, { color: p.text }]}>{value}</Text>
      <Text style={[styles.eyebrow, { color: p.textMuted }]}>{label}</Text>
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
    <View style={{ gap: spacing.sm }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Text style={[styles.stepNumber, { color: p.accentInk }]}>{i + 1}</Text>
          <Text style={[styles.body, { color: p.text, flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, letterSpacing: 0.3, textTransform: 'uppercase' },
  display: { fontFamily: fonts.display, fontSize: 46, lineHeight: 46, letterSpacing: 0.2, textTransform: 'uppercase' },
  heading: { fontFamily: fonts.displaySemi, fontSize: 22, lineHeight: 26, letterSpacing: 0.2, textTransform: 'uppercase' },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  card: { borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, gap: spacing.sm },
  button: {
    minHeight: MIN_TOUCH + 6,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLarge: { minHeight: 64, borderRadius: radius.lg },
  buttonText: { fontFamily: fonts.display, fontSize: 19, letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center' },
  buttonTextLarge: { fontSize: 24 },
  choice: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  choiceCompact: { minHeight: MIN_TOUCH, paddingVertical: spacing.xs + 2 },
  markRound: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  markSquare: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  markText: { fontSize: 13, fontFamily: fonts.bodyBold, lineHeight: 15 },
  pill: { borderRadius: radius.sm, paddingHorizontal: spacing.sm + 2, paddingVertical: 4, alignSelf: 'flex-start', maxWidth: '100%' },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 1 },
  stat: { flex: 1, minWidth: 0, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, gap: 2 },
  statValue: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, fontVariant: ['tabular-nums'] },
  stepNumber: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23, width: 18 },
});
