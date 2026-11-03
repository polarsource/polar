import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterFrame,
  PosterHeader,
  PosterHeadline,
  PosterMono,
} from './PosterFrame'

const UNITS: [string, string][] = [
  ['per token', '$0.000002'],
  ['per image', '$0.04'],
  ['per minute', '$0.015'],
  ['per seat', '$12.00'],
  ['per request', '$0.001'],
]

/** Whatever the unit is, it has a price next to it. */
export const UnitsPoster = () => (
  <PosterFrame surface="snow" signed>
    <PosterBody>
      <PosterHeader>RATES</PosterHeader>
      <Box flexDirection="column" rowGap="s">
        {UNITS.map(([unit, rate]) => (
          <Box key={unit} justifyContent="between" alignItems="baseline">
            <Text variant="heading-xxs" as="span" color="inherit">
              {unit}
            </Text>
            <PosterMono dim>{rate}</PosterMono>
          </Box>
        ))}
      </Box>
      <PosterHeadline primary="Priced per" secondary="anything" />
    </PosterBody>
  </PosterFrame>
)
