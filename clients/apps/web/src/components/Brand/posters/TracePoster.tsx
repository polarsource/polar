import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PosterCanvas, PosterFrame } from './PosterFrame'

interface Stop {
  text: string
  x: number
  y: number
}

/** One sentence, read along the route an event takes through Polar. */
const STOPS: Stop[] = [
  { text: 'One', x: 48, y: 64 },
  { text: 'integration', x: 232, y: 150 },
  { text: 'from', x: 48, y: 236 },
  { text: 'first event', x: 200, y: 322 },
  { text: 'to payout', x: 48, y: 420 },
]

/** The route turns at right angles between stops, one node per word. */
const route = STOPS.map(({ x, y }, i) => {
  if (i === 0) return `M ${x} ${y}`
  const prev = STOPS[i - 1]
  return `L ${prev.x} ${y} L ${x} ${y}`
}).join(' ')

export const TracePoster = () => (
  <PosterFrame surface="night" signed>
    <PosterCanvas>
      <path d={route} opacity={0.4} />
      {STOPS.map(({ x, y }, i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={4}
          fill={i === 0 || i === STOPS.length - 1 ? 'currentColor' : 'none'}
        />
      ))}
    </PosterCanvas>
    {STOPS.map(({ text, x, y }) => (
      <Box
        key={text}
        position="absolute"
        left={`${((x + 14) / 400) * 100}%`}
        top={`${(y / 500) * 100}%`}
        transform="translateY(-50%)"
      >
        <Text variant="heading-xs" as="span" color="inherit" wrap="nowrap">
          {text}
        </Text>
      </Box>
    ))}
  </PosterFrame>
)
