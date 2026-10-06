import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterCanvas,
  PosterFrame,
  PosterHeadline,
  PosterMono,
} from '../PosterFrame'

/** 19. Every unit has a price, however small. */
export const RatePoster = () => (
  <PosterFrame surface="snow" signed>
    <PosterBody>
      <Box justifyContent="between">
        <PosterMono>RATE</PosterMono>
        <PosterMono dim>PER TOKEN</PosterMono>
      </Box>
      <Text variant="heading-m" as="p" color="inherit" tabularNums>
        $0.000002
      </Text>
      <PosterHeadline primary="Every unit" secondary="has a price" />
    </PosterBody>
  </PosterFrame>
)

const CREDIT_CELLS = 40
const CREDITS_USED = 11

/** 20. Credits: a balance you can see going down. */
export const CreditsPoster = () => (
  <PosterFrame surface="ether" signed>
    <PosterBody>
      <Box justifyContent="between">
        <PosterMono>CREDITS</PosterMono>
        <PosterMono dim>7,250 / 10,000</PosterMono>
      </Box>
      <Grid templateColumns="repeat(8, 1fr)" gap="s">
        {Array.from({ length: CREDIT_CELLS }, (_, i) => (
          <div
            key={i}
            className={
              i < CREDITS_USED
                ? 'aspect-square rounded-full border border-current'
                : 'aspect-square rounded-full bg-current'
            }
          />
        ))}
      </Grid>
      <PosterHeadline
        primary="Prepaid, metered,"
        secondary="never a surprise"
      />
    </PosterBody>
  </PosterFrame>
)

const BARS = [
  { label: 'PRICE', width: 300 },
  { label: 'COST', width: 190 },
]

/** 21. The gap between the two bars is the whole business. */
export const MarginPoster = () => (
  <PosterFrame surface="night" signed>
    <PosterCanvas>
      {BARS.map(({ width }, i) => {
        const y = 200 + i * 48
        return (
          <g key={width}>
            <line x1={32} y1={y} x2={32 + width} y2={y} strokeWidth={2} />
            <line x1={32 + width} y1={y - 6} x2={32 + width} y2={y + 6} />
          </g>
        )
      })}
      <line
        x1={32 + BARS[1].width}
        y1={176}
        x2={32 + BARS[1].width}
        y2={272}
        strokeDasharray="2 4"
        opacity={0.5}
      />
      <line
        x1={32 + BARS[0].width}
        y1={176}
        x2={32 + BARS[0].width}
        y2={272}
        strokeDasharray="2 4"
        opacity={0.5}
      />
    </PosterCanvas>
    {BARS.map(({ label }, i) => (
      <Box
        key={label}
        position="absolute"
        left={{ base: 'xl', md: '2xl' }}
        top={`${((200 + i * 48 - 22) / 500) * 100}%`}
      >
        <PosterMono dim>{label}</PosterMono>
      </Box>
    ))}
    <Box position="absolute" left="58%" top="29%">
      <PosterMono>MARGIN 37%</PosterMono>
    </Box>
    <PosterBody justifyContent="end">
      <PosterHeadline
        primary="Know what each one"
        secondary="costs you to serve"
      />
    </PosterBody>
  </PosterFrame>
)
