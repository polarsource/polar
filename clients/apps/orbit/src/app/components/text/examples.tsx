import { Box } from '@polar-sh/orbit/Box'
import { Text, type TextColor, type TextVariant } from '@polar-sh/orbit'

const variants: TextVariant[] = [
  'heading-2xl',
  'heading-xl',
  'heading-l',
  'heading-m',
  'heading-s',
  'heading-xs',
  'heading-xxs',
  'body',
  'default',
  'label',
  'caption',
]

// monospace is an independent boolean prop, not a variant: it swaps the font
// family while keeping whatever size/weight the variant defines.
const monospaceVariants: TextVariant[] = [
  'heading-s',
  'body',
  'default',
  'label',
]

const colors: TextColor[] = [
  'default',
  'muted',
  'disabled',
  'accent',
  'success',
  'warning',
  'danger',
  'inverse',
]

export function VariantSamples() {
  return (
    <Box flexDirection="column" rowGap="xl" width="100%">
      {variants.map((variant) => (
        <Box
          key={variant}
          flexDirection="column"
          rowGap="xs"
          paddingBottom="l"
          borderBottomWidth={1}
          borderStyle="solid"
          borderColor="border-secondary"
        >
          <Text monospace color="default">
            {variant}
          </Text>
          <Text variant={variant}>The quick brown fox</Text>
        </Box>
      ))}
    </Box>
  )
}

export function MonospaceSamples() {
  return (
    <Box flexDirection="column" rowGap="xl" width="100%">
      {monospaceVariants.map((variant) => (
        <Box
          key={variant}
          flexDirection="column"
          rowGap="xs"
          paddingBottom="l"
          borderBottomWidth={1}
          borderStyle="solid"
          borderColor="border-secondary"
        >
          <Text variant="caption" color="muted">
            variant=&quot;{variant}&quot; monospace
          </Text>
          <Text variant={variant} monospace>
            npm install @polar-sh/orbit
          </Text>
        </Box>
      ))}
    </Box>
  )
}

export function ColorSamples() {
  return (
    <Box flexDirection="column" rowGap="m" width="100%">
      {colors.map((color) => (
        <Box key={color} alignItems="baseline" columnGap="m">
          <Box width={96} flexShrink={0}>
            <Text monospace color="default">
              {color}
            </Text>
          </Box>
          {color === 'inverse' ? (
            <Box
              paddingHorizontal="m"
              paddingVertical="xs"
              borderRadius="s"
              backgroundColor="background-inverse"
            >
              <Text color={color}>Sample text in this color</Text>
            </Box>
          ) : (
            <Text color={color}>Sample text in this color</Text>
          )}
        </Box>
      ))}
    </Box>
  )
}

export function StateSamples() {
  return (
    <Box flexDirection="column" rowGap="xl" width="100%" maxWidth={360}>
      <Box flexDirection="column" rowGap="xs">
        <Text monospace color="default">
          loading
        </Text>
        <Text loading placeholderText="Loading a single line of text" />
      </Box>
      <Box flexDirection="column" rowGap="xs">
        <Text monospace color="default">
          loading, placeholderNumberOfLines=3
        </Text>
        <Text loading placeholderNumberOfLines={3} />
      </Box>
      <Box flexDirection="column" rowGap="xs">
        <Text monospace color="default">
          lineThrough
        </Text>
        <Text lineThrough color="default">
          Previous price
        </Text>
      </Box>
    </Box>
  )
}
