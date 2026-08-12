import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'
import { Chapter } from '../Chapter'

const CheckoutVignette = () => (
  <Box
    flexDirection="column"
    rowGap="l"
    backgroundColor="background-card"
    borderRadius="m"
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
    borderRadius="m"
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
      height="0.375rem"
      borderRadius="full"
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
        borderRadius="m"
        paddingHorizontal="xl"
        paddingVertical="l"
      >
        <Box flexDirection="column">
          <Text variant="body">{row.name}</Text>
          <Text variant="body" color="muted">
            {row.tokens}
          </Text>
        </Box>
        <Text
          variant="body"
          color={row.negative ? 'danger' : 'success'}
          tabularNums
        >
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
    borderRadius="m"
    padding="xl"
    width="100%"
    maxWidth="19rem"
  >
    <Box justifyContent="between" alignItems="baseline" columnGap="l">
      <Text variant="body">Payout</Text>
      <Text variant="body" color="success" tabularNums>
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
    desc: 'Events aggregated into meters in real time.',
    vignette: <MeterVignette />,
  },
  {
    title: 'Checkout',
    desc: 'Hosted checkout that converts, localized and tax-inclusive.',
    vignette: <CheckoutVignette />,
  },
  {
    title: 'Cost insights',
    desc: 'Revenue minus cost, per customer.',
    vignette: <MarginVignette />,
  },
  {
    title: 'Payouts',
    desc: 'Settled to your bank. Tax already handled.',
    vignette: <PayoutVignette />,
  },
]

export const Platform = () => (
  <Chapter
    name="Platform"
    title="The brains of a finance team"
    subtitle="in the body of an API"
    description="Ingestion to payout, one integration."
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
          <Box flexDirection="column" rowGap="s">
            <Text variant="heading-xxs" as="h3">
              {pillar.title}
            </Text>
            <Box display="block" maxWidth="20rem">
              <Text variant="body" color="muted" wrap="pretty">
                {pillar.desc}
              </Text>
            </Box>
          </Box>
        </Box>
      ))}
    </Grid>
  </Chapter>
)
