import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { UsageBillingMock } from './UsageBillingMock'

interface Feature {
  label: string
  href: string
}

const FEATURES: Feature[] = [
  { label: 'Event ingestion', href: '/features/event-ingestion' },
  { label: 'Real-time meters', href: '/features/meters' },
  { label: 'Usage billing', href: '/features/usage-billing' },
  { label: 'Credits', href: '/features/credits' },
  { label: 'Cost insights', href: '/features/cost-insights' },
]

export const UsageBilling = () => (
  <Box
    as="section"
    width="100%"
    flexDirection="column"
    rowGap={{ base: '3xl', md: '5xl' }}
    paddingBottom={{ base: '4xl', md: '5xl' }}
    marginBottom={{ base: 'none', md: '2xl' }}
  >
    <Grid
      templateColumns={{ base: '1fr', lg: '3fr 1fr' }}
      gap={{ base: '3xl', lg: '4xl' }}
      alignItems="center"
    >
      <UsageBillingMock />
      <Box flexDirection="column" rowGap="3xl">
        <Box display="block">
          <Text variant="heading-xs" as="span">
            Ship usage billing today.{' '}
          </Text>
          <Text variant="heading-xs" as="span" color="muted">
            Real-time metering, billing and metrics, built in.
          </Text>
        </Box>
        <Box flexDirection="column" rowGap="s">
          <Text variant="caption" color="muted">
            Features
          </Text>
          <Box as="ul" flexDirection="column" rowGap="xs">
            {FEATURES.map((feature) => (
              <Box as="li" key={feature.href}>
                <Link href={feature.href}>
                  <Box
                    as="span"
                    color={{ base: 'text-primary', hover: 'text-secondary' }}
                    transitionProperty="colors"
                    transitionDuration="fast"
                  >
                    <Text variant="body" as="span" color="inherit">
                      {feature.label}
                    </Text>
                  </Box>
                </Link>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Grid>
  </Box>
)
