import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type IconProps = { color: ColorValue; size?: number };
const stroke = { fill: 'none', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

/** Dumbbell: today's training. */
export function TodayIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
    </Svg>
  );
}
/** Open book: the exercise library. */
export function LearnIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5zM12 6.5v13" />
    </Svg>
  );
}
/** Rising bars: progress. */
export function ProgressIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Rect x={4} y={13} width={3.5} height={7} rx={1} />
      <Rect x={10.25} y={9} width={3.5} height={11} rx={1} />
      <Rect x={16.5} y={4} width={3.5} height={16} rx={1} />
    </Svg>
  );
}
export function ProfileIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </Svg>
  );
}
/** Flame: hard days beaten. */
export function FlameIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.4 3.6-8.3.4 1.9 1.6 3 2.6 3.4.1-2.6 1.3-5.2 3.3-6.9.3 3 3.5 5.5 3.5 10 0 4.6-2.7 8-6.5 8z" />
    </Svg>
  );
}
