import { Box } from '@polar-sh/orbit/Box'
import { PageHeader, Section, Prose, Example } from '@/components/docs'
import { Text } from '@polar-sh/orbit'
import type { SpacingToken } from '@polar-sh/orbit/theme'

const SCALE: { token: SpacingToken; px: number }[] = [
  { token: 'none', px: 0 },
  { token: 'xs', px: 4 },
  { token: 's', px: 8 },
  { token: 'm', px: 12 },
  { token: 'l', px: 16 },
  { token: 'xl', px: 24 },
  { token: '2xl', px: 32 },
  { token: '3xl', px: 48 },
  { token: '4xl', px: 64 },
  { token: '5xl', px: 96 },
]

const GAP_CODE = `<Box flexDirection="column" gap="m" padding="xl">
  <Box>First</Box>
  <Box>Second</Box>
</Box>`

export default function SpacingPage() {
  return (
    <>
      <PageHeader
        title="Spacing"
        description="A single spacing scale powers padding, margin, and gaps. Pass token names to props like padding, margin, gap, rowGap, and columnGap."
      />

      <Section>
        <Prose>
          <Text variant="body" color="default">
            The scale is intentionally small so layouts stay consistent. Prefer
            a token over an arbitrary pixel value. Spacing props accept these
            tokens directly, and margin props additionally accept the value
            auto.
          </Text>
        </Prose>
      </Section>

      <Section
        title="Scale"
        description="Each step and its resolved pixel value."
      >
        <Box flexDirection="column" rowGap="m">
          {SCALE.map(({ token, px }) => (
            <Box key={token} alignItems="center" columnGap="l">
              <Box width={64} flexShrink={0}>
                <Text monospace color="inherit">
                  {token}
                </Text>
              </Box>
              <Box width={56} flexShrink={0}>
                <Text variant="caption" color="default">
                  {px}px
                </Text>
              </Box>
              <Box
                height={16}
                width={px === 0 ? 1 : px}
                minWidth={px === 0 ? 1 : undefined}
                borderRadius="s"
                backgroundColor="background-inverse"
              />
            </Box>
          ))}
        </Box>
      </Section>

      <Section
        title="Usage"
        description="Gap and padding both consume the same scale, so rhythm stays uniform across nesting levels."
      >
        <Example align="stretch" code={GAP_CODE}>
          <Box
            flexDirection="column"
            gap="m"
            padding="xl"
            borderRadius="m"
            backgroundColor="background-secondary"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            {['First', 'Second', 'Third'].map((label) => (
              <Box
                key={label}
                padding="m"
                borderRadius="s"
                backgroundColor="background-card"
                borderWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
              >
                <Text color="inherit">{label}</Text>
              </Box>
            ))}
          </Box>
        </Example>
      </Section>
    </>
  )
}
