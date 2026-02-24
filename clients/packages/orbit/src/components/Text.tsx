import { tokens } from '../tokens/vars'
import { createText } from '../primitives/createText'

export const Text = createText({
  default: tokens.COLORS.TEXT,
  subtle: tokens.COLORS['TEXT_SUBTLE'],
  disabled: tokens.COLORS['TEXT_DISABLED'],
})

export type { TextStyleProps, TextVariant } from '../primitives/createText'
