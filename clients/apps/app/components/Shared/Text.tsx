import { TextVariantKey, textVariants } from '@/design-system/textVariants'
import { BorderRadiiToken, ColorToken, Theme } from '@/design-system/theme'
import { createText, TextProps } from '@shopify/restyle'
import { Text as RNText } from 'react-native'
import { Box } from './Box'
import { PlaceholderBox } from './PlaceholderBox'

const RestyleText = createText<Theme>()

type Props = TextProps<Theme> &
  React.ComponentProps<typeof RNText> & {
    variant?: TextVariantKey
    loading?: boolean
    placeholderText?: string
    placeholderNumberOfLines?: number
    placeholderColor?: ColorToken
    borderRadius?: BorderRadiiToken
  }

export const Text = ({
  variant = 'body',
  loading,
  placeholderText,
  placeholderNumberOfLines = 1,
  placeholderColor,
  borderRadius = 'border-radius-6',
  ...rest
}: Props) => {
  if (loading) {
    const variantStyle = textVariants[variant] ?? textVariants.defaults
    const fontSize =
      variantStyle.fontSize ?? textVariants.defaults.fontSize ?? 16
    const lineHeight =
      variantStyle.lineHeight ?? textVariants.defaults.lineHeight ?? 22
    const lineGap = lineHeight - fontSize

    if (placeholderNumberOfLines > 1) {
      return (
        <Box style={{ gap: lineGap }}>
          {Array.from({ length: placeholderNumberOfLines }).map((_, index) => (
            <PlaceholderBox
              key={index}
              height={fontSize}
              borderRadius={borderRadius}
              width={index === placeholderNumberOfLines - 1 ? '60%' : '100%'}
              color={placeholderColor}
            />
          ))}
        </Box>
      )
    }

    return (
      <Box position="relative" justifyContent="center">
        <RestyleText
          variant={variant}
          {...rest}
          style={[rest.style, { opacity: 0 }]}
        >
          {placeholderText ?? 'Loading...'}
        </RestyleText>
        <PlaceholderBox
          height={fontSize}
          borderRadius={borderRadius}
          style={{ position: 'absolute', left: 0, right: 0 }}
          color={placeholderColor}
        />
      </Box>
    )
  }

  return <RestyleText variant={variant} {...rest} />
}
