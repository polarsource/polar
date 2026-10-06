import { Box } from '@polar-sh/orbit/Box'
import {
  POSTER_HEIGHT,
  POSTER_WIDTH,
  PosterBody,
  PosterCanvas,
  PosterFrame,
  PosterHeader,
  PosterHeadline,
  PosterMono,
} from './PosterFrame'

const PAD = 32
const BASELINE = 332
const CHART_TOP = 150
const DAYS = [
  12, 14, 13, 18, 17, 22, 21, 26, 30, 28, 34, 38, 37, 44, 48, 47, 55, 61, 60,
  68, 74, 73, 82, 90, 88, 97, 96, 104, 112, 110, 120,
]
const PEAK = Math.max(...DAYS)
const STEP = (POSTER_WIDTH - PAD * 2) / DAYS.length
const BAR = STEP * 0.2

/** A month of usage, every day of it already invoiced. */
export const GrowthPoster = () => (
  <PosterFrame surface="night" signed>
    <PosterCanvas>
      <g fill="currentColor" stroke="none">
        {DAYS.map((value, i) => {
          const height = ((BASELINE - CHART_TOP) * value) / PEAK
          return (
            <rect
              key={i}
              x={PAD + i * STEP}
              y={BASELINE - height}
              width={BAR}
              height={height}
              opacity={i === DAYS.length - 1 ? 1 : 0.25}
            />
          )
        })}
      </g>
    </PosterCanvas>
    <Box
      position="absolute"
      left="none"
      right="none"
      top={`${((BASELINE + 10) / POSTER_HEIGHT) * 100}%`}
      justifyContent="between"
      paddingHorizontal={{ base: 'xl', md: '2xl' }}
    >
      <PosterMono dim>DAY 01</PosterMono>
      <PosterMono dim>DAY 31</PosterMono>
    </Box>
    <PosterBody>
      <PosterHeader>TOKENS / DAY</PosterHeader>
      <PosterHeadline primary="Every bar" secondary="already invoiced" />
    </PosterBody>
  </PosterFrame>
)
