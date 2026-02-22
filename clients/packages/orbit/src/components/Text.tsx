import { orbitTheme } from '../tokens/theme'
import { createText } from '../primitives/createText'

export const Text = createText(orbitTheme, {
  default: 'text',
  subtle: 'text-subtle',
  disabled: 'text-disabled',
})

export type { TextStyleProps, TextVariant } from '../primitives/createText'
