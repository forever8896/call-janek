import { Platform, ViewStyle } from 'react-native';

export const HG = {
  cream:    '#FFF6E9',
  butter:   '#FFE9C2',
  peach:    '#FFD6BA',
  rose:     '#FFC2D1',
  mint:     '#C8EBD9',
  sky:      '#BFDDF0',
  lilac:    '#D9CCEF',
  sand:     '#F0E6D2',

  ink:      '#1F1A14',
  inkSoft:  '#3D352A',
  inkMute:  '#7A6F5F',
  inkDim:   '#A89D8B',

  card:     '#FFFFFF',
  paper:    '#FFFAF0',
  rule:     'rgba(31, 26, 20, 0.08)',

  red:      '#E94B3C',
  redSoft:  '#FF8A7A',
  redInk:   '#7A1E16',
  green:    '#2D8C5C',
  greenSoft:'#A8E0BE',
  amber:    '#F2A93B',
  amberSoft:'#FFD98A',
} as const;

export const FONT = {
  display: Platform.select({
    ios: 'Fraunces_500Medium',
    android: 'Fraunces_500Medium',
    default: 'Fraunces_500Medium',
  })!,
  displayItalic: 'Fraunces_500Medium_Italic',
  displaySemi: 'Fraunces_600SemiBold',
  displaySemiItalic: 'Fraunces_600SemiBold_Italic',
  body: 'PlusJakartaSans_500Medium',
  bodySemi: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
};

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 16,
  pill: 999,
};

// Soft neobrutalism: hard offset shadow rendered as a positioned view layer.
// React Native's `shadow*` props are blurred/iOS-only; we get the crisp offset
// look with a behind-element border instead. Use `hardShadow` helper below.

export function hardShadow(offset = 4): ViewStyle {
  return {
    shadowColor: HG.ink,
    shadowOffset: { width: offset, height: offset },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  };
}

export const BORDER = {
  full: 2,
  half: 1.5,
};
