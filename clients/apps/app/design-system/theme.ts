import { buttonVariants } from '@/design-system/buttonVariants'
import { createTheme } from '@shopify/restyle'

const palette = {
  black: '#0B0B0B',
  white: '#F0F2F3',
}

const theme = createTheme({
  colors: {
    'background-primary': palette.black,
    'foreground-primary': palette.white,
  },
  spacing: {
    'spacing-8': 8,
    'spacing-16': 16,
    'spacing-24': 24,
    'spacing-40': 40,
  },
  borderRadii: {
    none: 0,
    'border-radius-4': 4,
    'border-radius-8': 8,
    'border-radius-16': 16,
    'border-radius-24': 24,
    'border-radius-full': 9999,
  },
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

export const darkTheme: Theme = {
  ...theme,
  colors: {
    ...theme.colors,
    'background-primary': palette.white,
    'foreground-primary': palette.black,
  },
}

export type Theme = typeof theme
export default theme
