import { buttonVariants } from '@/design-system/buttonVariants'
import { textVariants } from '@/design-system/textVariants'

import { createTheme } from '@shopify/restyle'

export const palette = {
  gray950: '#070708',
  gray900: '#0D0E10',
  gray800: '#141518',
  gray700: '#1B1B1D',
  gray600: '#3A3B40',
  gray500: '#6c6e7f',
  gray100: '#F2F2F7',
  gray50: '#E5E5EA',

  pureWhite: '#FFFFFF',
  pureBlack: '#000000',
  blackOverlay: '#000000cc',
  whiteDisabled: '#ffffff11',

  blue: '#0062FF',
  blueLight: '#007AFF',
  red: '#dc2626',
  redLight: '#ef4444',
  redDark: '#450a0a',

  // Status colors
  green: '#10b981',
  greenDark: '#022c22',
  yellow: '#eab308',
  yellowDark: '#422006',
  indigo: '#6366f1',
  indigoDark: '#1e1b4b',
} as const

export const colors = {
  'background-regular': palette.gray900,
  'foreground-regular': palette.pureWhite,

  // Semantic colors (migrated from old useTheme)
  background: palette.gray900,
  text: palette.pureWhite,
  subtext: palette.gray500,
  primary: palette.blue,
  secondary: palette.gray700,
  border: palette.gray700,
  card: palette.gray800,
  monochrome: palette.pureBlack,
  monochromeInverted: palette.pureWhite,
  error: palette.red,
  errorSubtle: palette.redDark,

  // Overlay colors
  overlay: palette.blackOverlay,
  disabled: palette.whiteDisabled,
  inputBackground: 'rgba(255, 255, 255, 0.05)',
  inputPlaceholder: 'rgba(255, 255, 255, 0.5)',

  // Status pill colors
  statusGreen: palette.green,
  statusGreenBg: palette.greenDark,
  statusYellow: palette.yellow,
  statusYellowBg: palette.yellowDark,
  statusRed: palette.redLight,
  statusRedBg: palette.redDark,
  statusBlue: palette.indigo,
  statusBlueBg: palette.indigoDark,
} as const

export const dimension = {
  'dimension-1': 1,
  'dimension-2': 2,
  'dimension-4': 4,
  'dimension-6': 6,
  'dimension-8': 8,
  'dimension-10': 10,
  'dimension-12': 12,
  'dimension-16': 16,
  'dimension-24': 24,
  'dimension-32': 32,
  'dimension-40': 40,
  'dimension-48': 48,
  'dimension-50': 50,
  'dimension-54': 54,
  'dimension-56': 56,
  'dimension-64': 64,
  'dimension-80': 80,
  'dimension-120': 120,
} as const

export const spacing = {
  'spacing-1': 1,
  'spacing-2': 2,
  'spacing-4': 4,
  'spacing-6': 6,
  'spacing-8': 8,
  'spacing-10': 10,
  'spacing-12': 12,
  'spacing-16': 16,
  'spacing-20': 20,
  'spacing-24': 24,
  'spacing-32': 32,
  'spacing-40': 40,
  'spacing-48': 48,
  'spacing-54': 54,
  'spacing-56': 56,
  'spacing-64': 64,
  'spacing-80': 80,
  'spacing-120': 120,
} as const

export const borderRadii = {
  none: 0,
  'border-radius-2': 2,
  'border-radius-4': 4,
  'border-radius-6': 6,
  'border-radius-8': 8,
  'border-radius-10': 10,
  'border-radius-12': 12,
  'border-radius-16': 16,
  'border-radius-24': 24,
  'border-radius-32': 32,
  'border-radius-100': 100,
  'border-radius-999': 999,
  'border-radius-full': 9999,
} as const

const theme = createTheme({
  colors,
  dimension,
  spacing,
  borderRadii,
  textVariants,
  buttonVariants,
})

export type Theme = typeof theme
export default theme
export type ColorToken = keyof typeof colors
export type SpacingToken = keyof typeof spacing
export type BorderRadiiToken = keyof typeof borderRadii
export type DimensionToken = keyof typeof dimension
