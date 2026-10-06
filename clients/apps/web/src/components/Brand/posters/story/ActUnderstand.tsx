import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterFrame,
  PosterHeadline,
  PosterMono,
  PosterRule,
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
        <Box justifyContent="between" paddingVertical="s">
          <PosterMono dim>CUSTOMER</PosterMono>
          <PosterMono dim>MARGIN</PosterMono>
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
        primary="Your best customer is losing you money"
        secondary="Polar shows you which one"
      />
    </PosterBody>
  </PosterFrame>
)

/** 29. Or just ask. */
export const AgentPoster = () => (
  <PosterFrame surface="snow" signed>
    <PosterBody>
      <Box flexDirection="column" rowGap="xl">
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
            <Box as="span" opacity={0.5}>
              Three customers crossed zero: Atlas, Northwind and Lumen. Want me
              to send each of them a checkout link?
            </Box>
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

/** 30. Back where the landing page ends. */
export const ClosingPoster = () => (
  <PosterFrame surface="ether" signed>
    <PosterBody>
      <PosterMono dim>FIN.</PosterMono>
      <PosterHeadline
        primary="From usage to revenue"
        secondary="Integrate in an afternoon"
        size="heading-xs"
      />
    </PosterBody>
  </PosterFrame>
)
