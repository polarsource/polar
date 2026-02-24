import { tokens } from '../tokens/vars'
import { createText } from '../primitives/createText'

export const Text = createText({
  default: tokens.colors.text,
  subtle: tokens.colors['text-subtle'],
  disabled: tokens.colors['text-disabled'],
})

export type { TextStyleProps, TextVariant } from '../primitives/createText'
