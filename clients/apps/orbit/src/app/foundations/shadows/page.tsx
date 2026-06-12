import { Box } from '@polar-sh/orbit/Box'
import { PageHeader, Section, Prose, Example } from '@/components/docs'
import { Text } from '@polar-sh/orbit'
import type { ShadowToken } from '@polar-sh/orbit/theme'

const SHADOWS: { token: ShadowToken; note: string }[] = [
  { token: 'none', note: 'Flat, no elevation' },
  { token: 's', note: 'Subtle lift for resting cards' },
  { token: 'm', note: 'Hover and raised surfaces' },
  { token: 'l', note: 'Popovers and dropdowns' },
  { token: 'xl', note: 'Dialogs and overlays' },
]

const SHADOW_CODE = `<Box
  boxShadow="m"
  borderRadius="l"
  padding="xl"
  backgroundColor="background-card"
>
  Elevated surface
</Box>`

export default function ShadowsPage() {
  return (
    <>
      <PageHeader
        title="Shadows"
        description="Elevation tokens for layering surfaces above the page. Pass token names to the boxShadow prop."
      />

      <Section>
        <Prose>
          <Text variant="body" color="default">
            Shadows are soft and low-contrast so elevation reads clearly without
            heavy edges. Raise the level as an element floats further from the
            page: resting cards take s, interactive states take m, and floating
            layers like menus and dialogs take l or xl.
          </Text>
        </Prose>
      </Section>

      <Section
        title="Scale"
        description="Each token rendered on a card surface so the elevation is visible."
      >
        <Box
          display="grid"
          gridTemplateColumns={{
            base: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          }}
          gap="2xl"
          padding="xl"
        >
          {SHADOWS.map(({ token, note }) => (
            <Box key={token} flexDirection="column" rowGap="m">
              <Box
                height={112}
                borderRadius="l"
                backgroundColor="background-card"
                boxShadow={token}
              />
              <Box flexDirection="column" rowGap="xs">
                <Text variant="mono" color="inherit">
                  {token}
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
        description="Pair boxShadow with a hover state to animate elevation on interactive surfaces."
      >
        <Example code={SHADOW_CODE}>
          <Box
            boxShadow="m"
            borderRadius="l"
            padding="xl"
            backgroundColor="background-card"
          >
            <Text color="inherit">Elevated surface</Text>
          </Box>
        </Example>
      </Section>
    </>
  )
}
