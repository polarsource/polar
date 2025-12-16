// eslint-disable-next-line @polar/no-restyle-use-theme
import { useTheme as useRestyleTheme } from '@shopify/restyle'
import { Theme } from './theme'

export const useTheme = () => useRestyleTheme<Theme>()
