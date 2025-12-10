import { buttonVariants } from '@/design-system/buttonVariants'

import { createTheme } from '@shopify/restyle'

export const palette = {
  gray900: '#0D0E10',
  gray800: '#141518',
  gray700: '#222328',
  gray500: '#6c6e7f',
  gray100: '#F2F2F7',
  gray50: '#E5E5EA',

  pureWhite: '#FFFFFF',
  pureBlack: '#000000',

  blue: '#0062FF',
  blueLight: '#007AFF',
  red: '#dc2626',
  redDark: '#450a0a',
} as const

export const colors = {
  'background-regular': palette.gray900,
  'foreground-regular': palette.pureWhite,
} as const

export const spacing = {
  'spacing-4': 4,
  'spacing-8': 8,
  'spacing-12': 12,
  'spacing-16': 16,
  'spacing-20': 20,
  'spacing-24': 24,
  'spacing-32': 32,
  'spacing-40': 40,
  'spacing-48': 48,
} as const

export const borderRadii = {
  none: 0,
  'border-radius-4': 4,
  'border-radius-8': 8,
  'border-radius-16': 16,
  'border-radius-24': 24,
  'border-radius-full': 9999,
} as const

const theme = createTheme({
  colors,
  spacing,
  borderRadii,
  textVariants: {
    header: {
      fontWeight: 'bold',
      fontSize: 34,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
    },
    defaults: {},
  },
  buttonVariants,
})

export type Theme = typeof theme
export default theme
export type ColorToken = keyof typeof colors
export type SpacingToken = keyof typeof spacing
export type BorderRadiiToken = keyof typeof borderRadii
