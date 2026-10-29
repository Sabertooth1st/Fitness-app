/**
 * Original schematic body diagram drawn for ARRIVE (no third-party artwork).
 * It shows which areas a movement involves; it does not show activation
 * percentages, injury status or recovery. Text labels are always rendered, and
 * primary vs secondary areas differ by pattern (solid vs dashed outline) as
 * well as colour.
 */
import { Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Rect } from 'react-native-svg';
import type { Muscle } from '../domain/types';
import { usePalette } from '../features/app/AppState';
import { useT } from '../i18n';
import { spacing } from '../theme/tokens';
import { Body, Row, styles } from './ui';

type Shape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number };

const mirror = (cx: number, cy: number, rx: number, ry: number): Shape[] => [
  { kind: 'ellipse', cx, cy, rx, ry },
  { kind: 'ellipse', cx: 120 - cx, cy, rx, ry },
];

const FRONT: Partial<Record<Muscle, Shape[]>> = {
  front_shoulders: mirror(36, 55, 8, 7),
  side_shoulders: mirror(29, 60, 4, 7),
  chest: mirror(49, 66, 11, 9),
  biceps: mirror(28, 84, 5, 12),
  forearms: mirror(24, 112, 4.5, 13),
  abdominals: [{ kind: 'rect', x: 51, y: 78, w: 18, h: 38 }],
  obliques: mirror(44, 98, 4.5, 14),
  quadriceps: mirror(50, 160, 8.5, 25),
  adductors: mirror(57.5, 148, 2.5, 13),
};

const BACK: Partial<Record<Muscle, Shape[]>> = {
  rear_shoulders: mirror(36, 55, 8, 7),
  side_shoulders: mirror(29, 60, 4, 7),
  upper_back: [{ kind: 'rect', x: 46, y: 52, w: 28, h: 20 }],
  triceps: mirror(28, 84, 5, 12),
  forearms: mirror(24, 112, 4.5, 13),
  lats: mirror(46, 88, 7, 15),
  lower_back: [{ kind: 'rect', x: 53, y: 104, w: 14, h: 14 }],
  glutes: mirror(51, 132, 9.5, 10),
  hamstrings: mirror(50, 168, 8, 22),
  calves: mirror(50, 214, 6, 15),
};

function ShapeEl({ s, fill, stroke, dashed }: { s: Shape; fill: string; stroke: string; dashed: boolean }) {
  const common = { fill, stroke, strokeWidth: 1.5, strokeDasharray: dashed ? '3 2' : undefined };
  if (s.kind === 'circle') return <Circle cx={s.cx} cy={s.cy} r={s.r} {...common} />;
  if (s.kind === 'rect') return <Rect x={s.x} y={s.y} width={s.w} height={s.h} rx={4} {...common} />;
  return <Ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} />;
}

function Figure({ regions, primary, secondary, label }: { regions: Partial<Record<Muscle, Shape[]>>; primary: Muscle[]; secondary: Muscle[]; label: string }) {
  const p = usePalette();
  return (
    <View style={{ alignItems: 'center', gap: spacing.xs }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={120} height={250} viewBox="0 0 120 250">
        <G>
          <Circle cx={60} cy={22} r={14} fill={p.muscleBase} />
          <Rect x={38} y={44} width={44} height={84} rx={14} fill={p.muscleBase} />
          <Rect x={20} y={50} width={14} height={78} rx={7} fill={p.muscleBase} />
          <Rect x={86} y={50} width={14} height={78} rx={7} fill={p.muscleBase} />
          <Rect x={40} y={124} width={18} height={116} rx={9} fill={p.muscleBase} />
          <Rect x={62} y={124} width={18} height={116} rx={9} fill={p.muscleBase} />
        </G>
        {(Object.keys(regions) as Muscle[]).map((m) => {
          const isPrimary = primary.includes(m);
          const isSecondary = !isPrimary && secondary.includes(m);
          if (!isPrimary && !isSecondary) return null;
          return regions[m]!.map((s, i) => (
            <ShapeEl
              key={`${m}-${i}`}
              s={s}
              fill={isPrimary ? p.musclePrimary : p.muscleSecondary}
              stroke={p.text}
              dashed={isSecondary}
            />
          ));
        })}
      </Svg>
      <Text style={[styles.small, { color: p.textMuted }]}>{label}</Text>
    </View>
  );
}

export function MuscleMap({ primary, secondary }: { primary: Muscle[]; secondary: Muscle[] }) {
  const t = useT();
  const p = usePalette();
  const summary = `${t('exercise.primary')}: ${primary.map((m) => t.dyn(`muscle.${m}`)).join(', ')}. ${
    secondary.length ? `${t('exercise.secondary')}: ${secondary.map((m) => t.dyn(`muscle.${m}`)).join(', ')}.` : ''
  }`;
  return (
    <View accessible accessibilityLabel={summary} style={{ gap: spacing.sm }}>
      <Row gap={spacing.lg}>
        <Figure regions={FRONT} primary={primary} secondary={secondary} label={t('exercise.front')} />
        <Figure regions={BACK} primary={primary} secondary={secondary} label={t('exercise.backView')} />
      </Row>
      <View style={{ gap: 2 }}>
        <Text style={[styles.body, { color: p.text, fontWeight: '700' }]}>■ {t('exercise.primary')}</Text>
        <Body>{primary.map((m) => t.dyn(`muscle.${m}`)).join(', ')}</Body>
        {secondary.length > 0 && (
          <>
            <Text style={[styles.body, { color: p.text, fontWeight: '700', marginTop: spacing.xs }]}>⬚ {t('exercise.secondary')}</Text>
            <Body>{secondary.map((m) => t.dyn(`muscle.${m}`)).join(', ')}</Body>
          </>
        )}
      </View>
      <Text style={[styles.small, { color: p.textMuted }]}>{t('exercise.mapNote')}</Text>
    </View>
  );
}
