import { Box } from '@polar-sh/orbit/Box'
import { PageHeader, Section, Prose } from '@/components/docs'
import { Text } from '@polar-sh/orbit'
import {
  BACKGROUND_TOKENS,
  TEXT_TOKENS,
  BORDER_TOKENS,
  BackgroundSwatch,
  TextSwatch,
  BorderSwatch,
} from './swatches'

const GRID_COLUMNS = {
  base: '1fr',
  sm: 'repeat(2, 1fr)',
  lg: 'repeat(3, 1fr)',
} as const

export default function ColorsPage() {
  return (
    <>
      <PageHeader
        title="Colors"
        description="Semantic color tokens for surfaces, text, and borders. Pass token names to Box props such as backgroundColor, color, and borderColor."
      />

      <Section>
        <Prose>
          <Text color="muted">
            Every color token is defined with the CSS light-dark() function, so
            it resolves to the correct value for light or dark mode
            automatically. You never write dark: variants or duplicate values.
            Use semantic tokens by role, not by their literal appearance.
          </Text>
        </Prose>
      </Section>

      <Section
        title="Background colors"
        description="Surface tokens for pages, sections, cards, and status backgrounds. Apply with backgroundColor."
      >
        <Box display="grid" gridTemplateColumns={GRID_COLUMNS} gap="xl">
          {BACKGROUND_TOKENS.map(({ token, note }) => (
            <BackgroundSwatch key={token} token={token} note={note} />
          ))}
        </Box>
      </Section>

      <Section
        title="Text colors"
        description="Foreground tokens for copy and status text. Apply with the color prop on Box, then use Text with color inherit."
      >
        <Box display="grid" gridTemplateColumns={GRID_COLUMNS} gap="xl">
          {TEXT_TOKENS.map(({ token, note }) => (
            <TextSwatch key={token} token={token} note={note} />
          ))}
        </Box>
      </Section>

      <Section
        title="Border colors"
        description="Tokens for borders and dividers. Apply with borderColor alongside borderWidth and borderStyle."
      >
        <Box display="grid" gridTemplateColumns={GRID_COLUMNS} gap="xl">
          {BORDER_TOKENS.map(({ token, note }) => (
            <BorderSwatch key={token} token={token} note={note} />
          ))}
        </Box>
      </Section>
    </>
  )
}
