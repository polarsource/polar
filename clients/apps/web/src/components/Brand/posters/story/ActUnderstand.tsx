import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterCanvas,
  PosterFrame,
  PosterHeader,
  PosterHeadline,
  PosterMono,
  PosterRule,
  ETHER,
} from '../PosterFrame'

const CUSTOMERS: [string, string][] = [
  ['atlas', '+41%'],
  ['northwind', '+23%'],
  ['lumen', '-12%'],
]

/** 28. The insight, which is the point of all the bookkeeping. */
export const InsightPoster = () => (
  <PosterFrame surface="night" signed>
    <PosterBody>
      <Box flexDirection="column">
        <Box paddingBottom="s">
          <PosterHeader>MARGIN BY CUSTOMER</PosterHeader>
        </Box>
        {CUSTOMERS.map(([name, margin]) => (
          <Box key={name} flexDirection="column" rowGap="s" paddingTop="s">
            <PosterRule />
            <Box justifyContent="between">
              <PosterMono>{name}</PosterMono>
              <PosterMono>{margin}</PosterMono>
            </Box>
          </Box>
        ))}
      </Box>
      <PosterHeadline
        primary="Your best customer"
        secondary="loses you money"
      />
    </PosterBody>
  </PosterFrame>
)

/** 29. Or just ask. */
export const AgentPoster = () => (
  <PosterFrame surface="snow" signed>
    <PosterBody>
      <Box flexDirection="column" rowGap="xl">
        <PosterHeader />
        <Box flexDirection="column" rowGap="xs">
          <PosterMono dim>YOU</PosterMono>
          <Text
            variant="heading-xxs"
            as="p"
            color="inherit"
            wrap="pretty"
            leading="tight"
          >
            Which customers ran out of credits this week?
          </Text>
        </Box>
        <Box flexDirection="column" rowGap="xs">
          <PosterMono dim>POLAR</PosterMono>
          <Text
            variant="heading-xxs"
            as="p"
            color="inherit"
            wrap="pretty"
            leading="tight"
          >
            <span style={{ color: ETHER }}>
              Three customers crossed zero: Atlas, Northwind and Lumen. Shall I
              grant each of them 1,000 credits?
            </span>
          </Text>
        </Box>
      </Box>
      <PosterHeadline
        primary="Built for agents"
        secondary="so you can just ask"
      />
    </PosterBody>
  </PosterFrame>
)

const RING = { x: 200, y: 222, r: 108 }
const SWEEP = (320 * Math.PI) / 180
const END = {
  x: RING.x + RING.r * Math.cos(-Math.PI / 2 + SWEEP),
  y: RING.y + RING.r * Math.sin(-Math.PI / 2 + SWEEP),
}

/** 30. Back where the landing page ends: the loop, almost closed. */
export const ClosingPoster = () => (
  <PosterFrame surface="ether" signed>
    <PosterCanvas>
      <circle cx={RING.x} cy={RING.y} r={RING.r} opacity={0.3} />
      <path
        d={`M ${RING.x} ${RING.y - RING.r} A ${RING.r} ${RING.r} 0 1 1 ${END.x} ${END.y}`}
        strokeWidth={2}
      />
      <circle cx={END.x} cy={END.y} r={7} fill="currentColor" stroke="none" />
    </PosterCanvas>
    <PosterBody>
      <PosterHeader />
      <PosterHeadline
        primary="From usage to revenue"
        secondary="in an afternoon"
      />
    </PosterBody>
  </PosterFrame>
)
