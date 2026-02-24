import { tokens } from '../tokens/vars'
import { createText } from '../primitives/createText'

export const Text = createText({
  default: tokens.COLOR_TEXT,
  subtle: tokens.COLOR_TEXT_SUBTLE,
  disabled: tokens.COLOR_TEXT_DISABLED,
})

export type { TextStyleProps, TextVariant } from '../primitives/createText'
