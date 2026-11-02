/**
 * "Iron & chalk": graphite surfaces, chalk-white text and a safety-yellow
 * accent taken from gym hardware and hazard tape. Dark is the default look;
 * light mode keeps the same identity. Text/background pairs meet WCAG AA.
 *
 * `accent` is a FILL colour (buttons, bars); `accentInk` is the accent used as
 * text or a thin line on the page background, which needs more contrast in
 * light mode than the yellow fill can give.
 */
export interface Palette {
  scheme: 'dark' | 'light';
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  onAccent: string;
  accentInk: string;
  accentSoft: string;
  onAccentSoft: string;
  danger: string;
  onDanger: string;
  dangerSoft: string;
  onDangerSoft: string;
  warningSoft: string;
  onWarningSoft: string;
  success: string;
  muscleBase: string;
  musclePrimary: string;
  muscleSecondary: string;
  muscleOutline: string;
}

export const dark: Palette = {
  scheme: 'dark',
  background: '#0E0F11',
  surface: '#17191C',
  surfaceMuted: '#1F2226',
  surfaceRaised: '#262A2F',
  text: '#F2F0EB',
  textMuted: '#A2A5AB',
  border: '#2C3036',
  accent: '#FFD23F',
  onAccent: '#14130C',
  accentInk: '#FFD23F',
  accentSoft: '#2E2810',
  onAccentSoft: '#FFE58A',
  danger: '#FF5A4E',
  onDanger: '#1A0503',
  dangerSoft: '#341614',
  onDangerSoft: '#FFC2BC',
  warningSoft: '#2B2617',
  onWarningSoft: '#EFD99A',
  success: '#7BD88F',
  muscleBase: '#2A2E33',
  musclePrimary: '#FFD23F',
  muscleSecondary: '#8A7428',
  muscleOutline: '#F2F0EB',
};

export const light: Palette = {
  scheme: 'light',
  background: '#EFEDE8',
  surface: '#FFFFFF',
  surfaceMuted: '#E5E2DC',
  surfaceRaised: '#F7F6F3',
  text: '#121315',
  textMuted: '#55585E',
  border: '#D6D2CA',
  accent: '#FFC914',
  onAccent: '#14130C',
  accentInk: '#6E5300',
  accentSoft: '#FFF1BF',
  onAccentSoft: '#4A3800',
  danger: '#B42318',
  onDanger: '#FFFFFF',
  dangerSoft: '#FDE5E2',
  onDangerSoft: '#7A1710',
  warningSoft: '#FBF0D2',
  onWarningSoft: '#5C4300',
  success: '#1E7A3A',
  muscleBase: '#DCD8D0',
  musclePrimary: '#E0A800',
  muscleSecondary: '#F1D98A',
  muscleOutline: '#121315',
};

export const fonts = {
  display: 'BarlowCondensed_800ExtraBold',
  displaySemi: 'BarlowCondensed_600SemiBold',
  body: 'Barlow_500Medium',
  bodyRegular: 'Barlow_400Regular',
  bodyBold: 'Barlow_700Bold',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 18, pill: 999 } as const;
/** Minimum touch target in density-independent pixels. */
export const MIN_TOUCH = 48;
