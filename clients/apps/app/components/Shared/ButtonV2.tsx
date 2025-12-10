import {
  createRestyleComponent,
  createVariant,
  VariantProps,
} from '@shopify/restyle'
import { TouchableOpacity, ViewProps } from 'react-native'

import { Text } from '@/components/Shared/Text'
import { Theme } from '@/design-system/theme'

type RestyleProps = VariantProps<Theme, 'buttonVariants'> & ViewProps

const ButtonContainer = createRestyleComponent<RestyleProps, Theme>([
  createVariant({ themeKey: 'buttonVariants' }),
])

type Props = RestyleProps & {
  onPress: () => void
  text: string
}

export const ButtonV2 = ({
  onPress,
  text,
  variant = 'primary',
  ...rest
}: Props) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <ButtonContainer variant={variant} {...rest}>
        <Text>{text}</Text>
      </ButtonContainer>
    </TouchableOpacity>
  )
}
