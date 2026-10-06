import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterCanvas,
  PosterFrame,
  PosterHeadline,
} from './PosterFrame'

const CENTER = { x: 200, y: 206 }
const SPOKES = 10
const INNER = 30
const OUTER = 92

/** The radial spinner at rest: ten spokes, lit in a sweep around the dial. */
const spokes = Array.from({ length: SPOKES }, (_, i) => {
  const angle = (i / SPOKES) * Math.PI * 2 - Math.PI / 2
  return {
    x1: CENTER.x + Math.cos(angle) * INNER,
    y1: CENTER.y + Math.sin(angle) * INNER,
    x2: CENTER.x + Math.cos(angle) * OUTER,
    y2: CENTER.y + Math.sin(angle) * OUTER,
    opacity: 0.2 + 0.8 * (i / (SPOKES - 1)),
  }
})

/** The one accent sheet on the board. */
export const OrbitPoster = () => (
  <PosterFrame surface="ether" signed>
    <PosterCanvas>
      <g strokeWidth={2} strokeLinecap="round">
        {spokes.map((spoke, i) => (
          <line key={i} {...spoke} />
        ))}
      </g>
    </PosterCanvas>
    <PosterBody justifyContent="end">
      <Box>
        <PosterHeadline
          primary="Meet Polar"
          secondary="The billing stack for the intelligence era"
        />
      </Box>
    </PosterBody>
  </PosterFrame>
)
