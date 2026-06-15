import { Box } from '@polar-sh/orbit/Box'
import { PageHeader, Section, Prose, Example } from '@/components/docs'
import { Text } from '@polar-sh/orbit'
import type { BorderRadiusToken } from '@polar-sh/orbit/theme'

const RADII: { token: BorderRadiusToken; px: string; note: string }[] = [
  { token: 'none', px: '0', note: 'Square edges' },
  { token: 's', px: '8px', note: 'Inputs, small controls' },
  { token: 'm', px: '12px', note: 'Cards, panels' },
  { token: 'l', px: '16px', note: 'Large surfaces, modals' },
  { token: 'xl', px: '32px', note: 'Hero and feature surfaces' },
  { token: 'full', px: '9999px', note: 'Pills, avatars, circles' },
]

const RADIUS_CODE = `<Box borderRadius="m" padding="l" backgroundColor="background-card">
  Card
</Box>`

export default function RadiusPage() {
  return (
    <>
      <PageHeader
        title="Radius"
        description="Border radius tokens for rounding corners consistently. Pass token names to borderRadius or a single-corner prop."
      />

      <Section>
        <Prose>
          <Text variant="body" color="default">
            Match the radius to the size of the surface: smaller controls take
            s, cards take m, and large surfaces take l or xl. Use full for any
            element that should read as a pill or circle.
          </Text>
        </Prose>
      </Section>

      <Section title="Scale" description="Each token and its resolved value.">
        <Box
          display="grid"
          gridTemplateColumns={{
            base: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            lg: 'repeat(6, 1fr)',
          }}
          gap="xl"
        >
          {RADII.map(({ token, px, note }) => (
            <Box key={token} flexDirection="column" rowGap="s">
              <Box
                width="100%"
                height={96}
                borderRadius={token}
                backgroundColor="background-inverse"
              />
              <Box flexDirection="column" rowGap="xs">
                <Text monospace color="inherit">
                  {token}
                </Text>
                <Text variant="caption" color="default">
                  {px}
                </Text>
                <Text variant="caption" color="default">
                  {note}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      </Section>

      <Section
        title="Usage"
        description="Single-corner props such as borderTopLeftRadius accept the same tokens for asymmetric shapes."
      >
        <Example code={RADIUS_CODE}>
          <Box
            borderRadius="m"
            padding="xl"
            backgroundColor="background-card"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Text color="inherit">Card</Text>
          </Box>
        </Example>
      </Section>
    </>
  )
}
