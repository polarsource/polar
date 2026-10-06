import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterFrame,
  PosterHeadline,
  PosterMono,
} from './PosterFrame'

const SURFACES: [string, string][] = [
  ['SDK', 'polar.customers.getStateExternal()'],
  ['API', 'GET /v1/customers'],
  ['CLI', 'polar customers list'],
  ['MCP', 'search_tools "customers"'],
]

/** The four ways in, each with the line you would actually type. */
export const SurfacesPoster = () => (
  <PosterFrame surface="ether" signed>
    <PosterBody>
      <Box flexDirection="column" rowGap="m">
        {SURFACES.map(([name, sample]) => (
          <Box key={name} flexDirection="column">
            <Text variant="heading-s" as="p" color="inherit" leading="tight">
              {name}
            </Text>
            <PosterMono dim>{sample}</PosterMono>
          </Box>
        ))}
      </Box>
      <PosterHeadline primary="One platform" secondary="four ways in" />
    </PosterBody>
  </PosterFrame>
)
