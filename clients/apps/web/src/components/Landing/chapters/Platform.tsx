import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'
import { Chapter } from '../Chapter'

const CheckoutVignette = () => (
  <Box
    flexDirection="column"
    rowGap="l"
    backgroundColor="background-card"
    padding="xl"
    width="100%"
    maxWidth="19rem"
  >
    <Box justifyContent="between" alignItems="baseline" columnGap="xl">
      <Text variant="body">Pro plan</Text>
      <Text variant="body" color="muted">
        $20/mo
      </Text>
    </Box>
    <Box
      justifyContent="center"
      paddingVertical="s"
      borderRadius="full"
      backgroundColor="background-inverse"
    >
      <Text variant="body" color="inverse">
        Pay $20
      </Text>
    </Box>
  </Box>
)

const MeterVignette = () => (
  <Box
    flexDirection="column"
    rowGap="m"
    backgroundColor="background-card"
    padding="xl"
    width="100%"
    maxWidth="19rem"
  >
    <Box justifyContent="between" alignItems="baseline" columnGap="l">
      <Text variant="body" monospace>
        gpt-4o
      </Text>
      <Text variant="body" color="muted" tabularNums>
        1.2M tokens
      </Text>
    </Box>
    <Box
      display="block"
      height="0.2rem"
      backgroundColor="background-secondary"
      overflow="hidden"
    >
      <Box height="100%" width="72%" backgroundColor="background-inverse" />
    </Box>
  </Box>
)

const INSIGHT_ROWS = [
  { name: 'Jane Doe', tokens: '4.1M tokens', margin: '+86%', negative: false },
  {
    name: 'Michael Chen',
    tokens: '8.7M tokens',
    margin: '-19%',
    negative: true,
  },
]

const MarginVignette = () => (
  <Box flexDirection="column" rowGap="s" width="100%" maxWidth="19rem">
    <Box justifyContent="between" alignItems="baseline" paddingHorizontal="xl">
      <Text variant="caption" color="muted">
        Customer
      </Text>
      <Text variant="caption" color="muted">
        Gross margin
      </Text>
    </Box>
    {INSIGHT_ROWS.map((row) => (
      <Box
        key={row.name}
        justifyContent="between"
        alignItems="center"
        columnGap="l"
        backgroundColor="background-card"
        paddingHorizontal="xl"
        paddingVertical="l"
      >
        <Box flexDirection="column">
          <Text variant="body">{row.name}</Text>
          <Text variant="body" color="muted">
            {row.tokens}
          </Text>
        </Box>
        <Text variant="body" tabularNums>
          {row.margin}
        </Text>
      </Box>
    ))}
  </Box>
)

const PayoutVignette = () => (
  <Box
    flexDirection="column"
    rowGap="xs"
    backgroundColor="background-card"
    padding="xl"
    width="100%"
    maxWidth="19rem"
  >
    <Box justifyContent="between" alignItems="baseline" columnGap="l">
      <Text variant="body">Payout</Text>
      <Text variant="body" tabularNums>
        $9,311
      </Text>
    </Box>
    <Text variant="body" color="muted">
      Acme Inc · SEB **** 9128
    </Text>
  </Box>
)

interface Pillar {
  title: string
  desc: string
  vignette: ReactNode
}

const PILLARS: Pillar[] = [
  {
    title: 'Usage metering',
    desc: 'Every token, agent run and GPU second streams into live meters, priced and ready to bill the moment it happens.',
    vignette: <MeterVignette />,
  },
  {
    title: 'Checkout',
    desc: 'A hosted checkout that converts out of the box. Localized currencies, sales tax included, one link to start selling.',
    vignette: <CheckoutVignette />,
  },
  {
    title: 'Cost insights',
    desc: 'What each customer pays beside what their usage costs you. True gross margin per customer, updated in real time.',
    vignette: <MarginVignette />,
  },
  {
    title: 'Payouts',
    desc: 'Revenue settles to your bank account on your schedule. Sales tax already collected, remitted and off your plate.',
    vignette: <PayoutVignette />,
  },
]

export const Platform = () => (
  <Chapter
    name="Platform"
    title="The brains of a finance team"
    subtitle="in the body of an API"
    description="Polar meters your usage, runs your subscriptions & invoicing, and sells to your customers as merchant of record. One integration, from first event to payout."
  >
    <Grid
      templateColumns={{
        base: '1fr',
        md: 'repeat(2, 1fr)',
        xl: 'repeat(4, 1fr)',
      }}
      gap="l"
    >
      {PILLARS.map((pillar) => (
        <Box key={pillar.title} flexDirection="column" rowGap="xl">
          <Box
            backgroundColor="background-secondary"
            alignItems="center"
            justifyContent="center"
            paddingHorizontal="2xl"
            minHeight={{ base: '14rem', xl: '20rem' }}
          >
            {pillar.vignette}
          </Box>
          <Box flexDirection="column" rowGap="xs">
            <Text variant="heading-xs" as="h3">
              {pillar.title}
            </Text>
            <Box display="block">
              <Text variant="heading-xxs" color="muted" wrap="pretty">
                {pillar.desc}
              </Text>
            </Box>
          </Box>
        </Box>
      ))}
    </Grid>
  </Chapter>
)
