import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  POSTER_HEIGHT,
  POSTER_WIDTH,
  PosterCanvas,
  PosterFrame,
} from './PosterFrame'

const DEPTH = 5

/**
 * Columns halve in width towards the right edge, and each column is ruled
 * twice as finely as the one before it: the grid itself is the picture.
 */
const columns = Array.from({ length: DEPTH }, (_, depth) => {
  const x0 = POSTER_WIDTH * (1 - 0.5 ** depth)
  const x1 = POSTER_WIDTH * (1 - 0.5 ** (depth + 1))
  const divisions = 2 ** (depth + 1)
  const rows = Array.from(
    { length: divisions - 1 },
    (_, i) => (POSTER_HEIGHT * (i + 1)) / divisions,
  )
  return { x0, x1, rows }
})

export const GridPoster = () => (
  <PosterFrame surface="night">
    <PosterCanvas>
      <g opacity={0.35}>
        {columns.map(({ x0, x1, rows }) => (
          <g key={x0}>
            <line x1={x1} y1={0} x2={x1} y2={POSTER_HEIGHT} />
            {rows.map((y) => (
              <line key={y} x1={x0} y1={y} x2={x1} y2={y} />
            ))}
          </g>
        ))}
      </g>
    </PosterCanvas>
    <Box
      position="absolute"
      left="s"
      bottom="50%"
      paddingHorizontal="xs"
      paddingBottom="s"
      flexDirection="column"
    >
      <Text variant="heading-xxs" as="p" color="inherit" leading="tight">
        From usage
      </Text>
      <Text variant="heading-xxs" as="p" color="inherit" leading="tight">
        to revenue
      </Text>
    </Box>
  </PosterFrame>
)
