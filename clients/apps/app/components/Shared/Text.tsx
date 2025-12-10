import { TextVariantKey } from '@/design-system/textVariants'
import { Theme } from '@/design-system/theme'
import { createText, TextProps } from '@shopify/restyle'
import { Text as RNText } from 'react-native'

const RestyleText = createText<Theme>()

type Props = TextProps<Theme> &
  React.ComponentProps<typeof RNText> & {
    variant?: TextVariantKey
  }

export const Text = ({ variant = 'body', ...rest }: Props) => {
  return <RestyleText variant={variant} {...rest} />
}
