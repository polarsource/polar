import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChapterBody, Paragraph, VisionChapter } from './VisionProse'

const CAPABILITIES = [
  {
    title: 'Billing as a side effect',
    description: [
      'Reducers do two things: they compute the next state, and they emit effects when the state crosses a boundary. A meter passing its limit, a period ending, a balance going negative. An invoice is one of those effects. So is a charge, a top-up, an entitlement being revoked.',
      'None of them are stored as facts; they are consequences of the state, replayed from the same events every time. There is no billing table to drift out of sync with reality, because there is no billing table.',
    ],
  },
  {
    title: 'Instant meter checks',
    description: [
      'Every other platform answers a meter check with a round trip: query, sum, hope the cache is warm. The best of them land around 50ms, which is a long time to hold a request open before letting an agent run.',
      'Because the customer is a pure function of events, the SDK runs the same reducers locally, in your process, and reconciles the delta with the server behind the scenes. A meter check never leaves your machine. Check before every call. Nobody will notice.',
    ],
  },
  {
    title: 'Margins, as they happen',
    description: [
      'In Polar, costs are events too. Revenue in, cost in, margin out, per customer, in real time. Polar is the first billing platform in the world that knows your margins.',
    ],
  },
  {
    title: 'Branch the reducers',
    description: [
      'The log stays fixed. What you fork is the reducer that reads it. Replay last quarter through a different pricing reducer and see what margin would have been.',
      'Run three reducers against the same customers. Forecast the next quarter under each, then merge the one you believe in. Pricing becomes something you simulate before it touches a customer, by you today, by an agent soon.',
    ],
  },
  {
    title: 'Identities and Actors',
    description: [
      'The thing consuming your product is now a team, a key, an agent, an agent that agent spawned. So every event carries an Identity, which is billed, and an Actor, which did the thing. You always know which hand spent what.',
    ],
  },
]

const CapabilityList = () => (
  <Box as="ul" flexDirection="column">
    {CAPABILITIES.map((capability, index) => (
      <Box
        key={capability.title}
        as="li"
        display="flex"
        flexDirection={{ base: 'column', md: 'row' }}
        rowGap="m"
        columnGap="xl"
        paddingVertical="2xl"
      >
        <Box flex={1} alignItems="baseline" columnGap="l">
          <Text as="span" variant="heading-s" color="muted">
            {String(index + 1).padStart(2, '0')}
          </Text>
          <Text variant="heading-s" as="h3">
            {capability.title}
          </Text>
        </Box>
        <Box flex={1} flexDirection="column" rowGap="xl">
          {capability.description.map((paragraph) => (
            <Paragraph key={paragraph}>{paragraph}</Paragraph>
          ))}
        </Box>
      </Box>
    ))}
  </Box>
)

export const VisionDirection = () => (
  <VisionChapter
    name="Direction"
    after={
      <Box flexDirection="column" rowGap={{ base: '3xl', md: '5xl' }}>
        <CapabilityList />
        <ChapterBody>
          <Paragraph>
            This is where we are taking Polar. A fold has to begin somewhere,
            and it begins with the first event.
          </Paragraph>
        </ChapterBody>
      </Box>
    }
  >
    <Paragraph>
      We are evolving Polar into a system of record for the customer, built
      entirely on reducers. Everything that happens is an event: a token
      consumed, a seat added, a price changed, a refund. Events are never
      edited.
    </Paragraph>
    <Paragraph>
      Fold them and you get the customer&apos;s state: what they have used, what
      they are entitled to, what they owe. That fold is the primitive. Billing
      is one of the things derived from it.
    </Paragraph>
  </VisionChapter>
)
