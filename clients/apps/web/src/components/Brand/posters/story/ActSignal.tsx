import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterCanvas,
  PosterFrame,
  PosterHeadline,
  PosterMono,
} from '../PosterFrame'

const PAYLOAD = [
  '{',
  '  "name": "tokens.out",',
  '  "external_customer_id": "lumen",',
  '  "metadata": {',
  '    "model": "fable-5",',
  '    "tokens": 1204',
  '  }',
  '}',
]

/** 16. One event, as it arrives on the wire. */
export const EventPoster = () => (
  <PosterFrame surface="night" signed>
    <PosterBody>
      <Box flexDirection="column" rowGap="l">
        <PosterMono dim>POST /v1/events</PosterMono>
        <Box flexDirection="column">
          {PAYLOAD.map((line) => (
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
      </Box>
      <PosterHeadline primary="It starts with" secondary="one event" />
    </PosterBody>
  </PosterFrame>
)

const LINES = 24
const LINE_TOP = 64
const LINE_STEP = 12

/** 17. Then a million more: the same event, stacked until it blurs. */
export const StreamPoster = () => (
  <PosterFrame surface="night" signed>
    <PosterCanvas>
      {Array.from({ length: LINES }, (_, i) => {
        const y = LINE_TOP + i * LINE_STEP
        return (
          <line
            key={i}
            x1={232}
            y1={y}
            x2={368}
            y2={y}
            opacity={1 - (i / LINES) * 0.85}
          />
        )
      })}
    </PosterCanvas>
    <PosterBody>
      <PosterMono dim>× 1,000,000</PosterMono>
      <PosterHeadline primary="Then a" secondary="million more" />
    </PosterBody>
  </PosterFrame>
)

const SPEC: [string, string][] = [
  ['NAME', 'tokens.out'],
  ['AGGREGATION', 'sum(metadata.tokens)'],
  ['FILTER', 'model = fable-5'],
  ['WINDOW', 'billing period'],
]

/** 18. A meter is the sentence that turns events into a number. */
export const MeterPoster = () => (
  <PosterFrame surface="snow" signed>
    <PosterBody>
      <Box flexDirection="column">
        {SPEC.map(([key, value]) => (
          <Box
            key={key}
            justifyContent="between"
            columnGap="l"
            paddingVertical="s"
          >
            <PosterMono dim>{key}</PosterMono>
            <PosterMono>{value}</PosterMono>
          </Box>
        ))}
      </Box>
      <Box flexDirection="column" rowGap="l">
        <Text variant="heading-m" as="p" color="inherit" tabularNums>
          1,204,318
        </Text>
        <PosterHeadline primary="A meter gives them" secondary="meaning" />
      </Box>
    </PosterBody>
  </PosterFrame>
)
