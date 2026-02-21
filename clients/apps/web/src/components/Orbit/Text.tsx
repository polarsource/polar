import { orbitTheme } from './theme'
import { createText } from './utils/createText'

export const Text = createText(orbitTheme, {
  default: 'text',
  subtle: 'text-subtle',
  disabled: 'text-disabled',
})

export type { TextStyleProps, TextVariant } from './utils/createText'
