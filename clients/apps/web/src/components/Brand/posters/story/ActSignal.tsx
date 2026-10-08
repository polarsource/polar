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
} from '../PosterFrame'

const COMMAND = [
  'curl https://api.polar.sh/v1/events/ingest \\',
  '  -H "Authorization: Bearer $POLAR_TOKEN" \\',
  '  -d \'{"events": [{',
  '    "name": "tokens.out",',
  '    "external_customer_id": "lumen",',
  '    "metadata": {"tokens": 1204}',
  "  }]}'",
]

/** 16. One event, as it arrives on the wire. */
export const EventPoster = () => (
  <PosterFrame surface="night" signed>
    <PosterBody>
      <Box flexDirection="column" rowGap="l">
        <PosterHeader>POST /v1/events/ingest</PosterHeader>
        <Box flexDirection="column">
          {COMMAND.map((line) => (
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

const LINES = 16
const LINE_TOP = 84
const LINE_STEP = 16

/** 17. Then a million more: the same event, stacked until it blurs. */
export const StreamPoster = () => (
  <PosterFrame surface="night" signed>
    <PosterCanvas>
      {Array.from({ length: LINES }, (_, i) => {
        const y = LINE_TOP + i * LINE_STEP
        return (
          <line
            key={i}
            x1={32}
            y1={y}
            x2={368}
            y2={y}
            opacity={1 - (i / LINES) * 0.85}
          />
        )
      })}
    </PosterCanvas>
    <PosterBody>
      <PosterHeader>× 1,000,000</PosterHeader>
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
        <PosterHeader>METER</PosterHeader>
        {SPEC.map(([key, value]) => (
          <Box
            key={key}
            justifyContent="between"
            columnGap="l"
            paddingVertical="xs"
          >
            <PosterMono dim>{key}</PosterMono>
            <PosterMono>{value}</PosterMono>
          </Box>
        ))}
        <Box flexDirection="column" rowGap="m" paddingTop="m">
          <PosterRule />
          <Box justifyContent="between" alignItems="baseline" columnGap="l">
            <PosterMono dim>VALUE</PosterMono>
            <Text variant="heading-s" as="span" color="inherit" tabularNums>
              1,204,318
            </Text>
          </Box>
        </Box>
      </Box>
      <PosterHeadline primary="A meter gives" secondary="them meaning" />
    </PosterBody>
  </PosterFrame>
)
