import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PosterCanvas, PosterFrame } from './PosterFrame'

const CENTER = { x: 344, y: 468 }
const RINGS = 9
const STEP = 34

/** The platform in one paragraph; rings widen from the signature corner. */
export const StatementPoster = () => (
  <PosterFrame surface="snow" signed>
    <PosterCanvas>
      {Array.from({ length: RINGS }, (_, i) => (
        <circle
          key={i}
          cx={CENTER.x}
          cy={CENTER.y}
          r={40 + i * STEP}
          opacity={0.7 - (i / RINGS) * 0.55}
        />
      ))}
    </PosterCanvas>
    <Box
      position="absolute"
      top="none"
      left="none"
      right="none"
      padding={{ base: 'xl', md: '2xl' }}
    >
      <Text variant="body" as="p" color="inherit" wrap="pretty">
        Polar meters your usage, runs your subscriptions and invoicing, and
        sells to your customers as merchant of record. One integration, from
        first event to payout.
      </Text>
    </Box>
  </PosterFrame>
)
