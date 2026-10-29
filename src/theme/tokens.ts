/**
 * Calm, warm palette with restrained teal accents. Text/background pairs are
 * chosen for at least WCAG AA contrast (4.5:1 for body text).
 */
export interface Palette {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  onAccentSoft: string;
  danger: string;
  onDanger: string;
  dangerSoft: string;
  warningSoft: string;
  onWarningSoft: string;
  muscleBase: string;
  musclePrimary: string;
  muscleSecondary: string;
}

export const light: Palette = {
  background: '#FBF8F3',
  surface: '#FFFFFF',
  surfaceMuted: '#F2EEE7',
  text: '#1E2A28',
  textMuted: '#55615E',
  border: '#E3DCD0',
  accent: '#1D7064',
  onAccent: '#FFFFFF',
  accentSoft: '#DCEFEA',
  onAccentSoft: '#134D45',
  danger: '#A8261D',
  onDanger: '#FFFFFF',
  dangerSoft: '#FBE7E4',
  warningSoft: '#FDF1D8',
  onWarningSoft: '#5C4300',
  muscleBase: '#E6E0D6',
  musclePrimary: '#1D7064',
  muscleSecondary: '#8CC7BB',
};

export const dark: Palette = {
  background: '#111614',
  surface: '#1A211F',
  surfaceMuted: '#222B28',
  text: '#EEF2F0',
  textMuted: '#A9B5B1',
  border: '#2F3A37',
  accent: '#63C7B3',
  onAccent: '#0B201C',
  accentSoft: '#1E3833',
  onAccentSoft: '#BFE9DF',
  danger: '#FF8A80',
  onDanger: '#2B0705',
  dangerSoft: '#3A1D1A',
  warningSoft: '#3A3020',
  onWarningSoft: '#F5DFAE',
  muscleBase: '#34403C',
  musclePrimary: '#63C7B3',
  muscleSecondary: '#2E6F63',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
/** Minimum touch target in density-independent pixels. */
export const MIN_TOUCH = 48;
