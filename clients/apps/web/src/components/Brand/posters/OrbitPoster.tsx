import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  POSTER_HEIGHT,
  POSTER_WIDTH,
  PosterCanvas,
  PosterFrame,
} from './PosterFrame'

const CENTER = { x: POSTER_WIDTH / 2, y: POSTER_HEIGHT / 2 - 40 }
const ORBIT_RADIUS = 132
const SPHERE_RADIUS = 12
const ANGLE = (-40 * Math.PI) / 180

/** The one accent sheet on the board: a single sphere on a hairline orbit. */
export const OrbitPoster = () => (
  <PosterFrame surface="ether" signed>
    <PosterCanvas>
      <circle cx={CENTER.x} cy={CENTER.y} r={ORBIT_RADIUS} opacity={0.7} />
      <circle
        cx={CENTER.x + ORBIT_RADIUS * Math.cos(ANGLE)}
        cy={CENTER.y + ORBIT_RADIUS * Math.sin(ANGLE)}
        r={SPHERE_RADIUS}
        fill="currentColor"
        stroke="none"
      />
    </PosterCanvas>
    <Box
      position="absolute"
      left="none"
      right="none"
      bottom="none"
      flexDirection="column"
      padding={{ base: 'xl', md: '2xl' }}
      paddingRight="3xl"
    >
      <Text variant="heading-xxs" as="p" color="inherit" leading="tight">
        Meet Polar
      </Text>
      <Text
        variant="heading-xxs"
        as="p"
        color="inherit"
        wrap="balance"
        leading="tight"
      >
        <Box as="span" opacity={0.6}>
          The billing stack for the intelligence era
        </Box>
      </Text>
    </Box>
  </PosterFrame>
)
