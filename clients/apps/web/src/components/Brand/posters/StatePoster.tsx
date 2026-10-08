import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterFrame,
  PosterHeader,
  PosterHeadline,
} from './PosterFrame'

const STATE = [
  '{',
  '  "plan": "pro",',
  '  "access": ["api", "agents", "exports"],',
  '  "meters": { "tokens.out": 1204318 },',
  '  "credits": 7250',
  '}',
]

/** The whole customer, derived and returned from one call. */
export const StatePoster = () => (
  <PosterFrame surface="ether" signed>
    <PosterBody>
      <Box flexDirection="column">
        <PosterHeader>GET /v1/customers/lumen/state</PosterHeader>
        {STATE.map((line) => (
          <Text
            key={line}
            variant="caption"
            as="span"
            color="inherit"
            monospace
          >
            <span className="whitespace-pre">{line}</span>
          </Text>
        ))}
      </Box>
      <PosterHeadline primary="One call," secondary="the whole customer" />
    </PosterBody>
  </PosterFrame>
)
