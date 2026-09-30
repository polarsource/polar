import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Chapter } from '../Chapter'
import { DocsLink } from './DocsLink'

const API_REFERENCE = '/docs/api-reference'
const CURRENT = `${API_REFERENCE}/current`

interface Resource {
  path: string
  title: string
  desc: string
  href: string
}

const RESOURCES: Resource[] = [
  {
    path: '/v1/checkouts',
    title: 'Checkouts',
    desc: 'Open a hosted checkout for any product.',
    href: `${CURRENT}/checkouts/create-checkout-session`,
  },
  {
    path: '/v1/customers',
    title: 'Customers',
    desc: 'Profiles, external ids and full customer state.',
    href: `${CURRENT}/customers/list-customers`,
  },
  {
    path: '/v1/subscriptions',
    title: 'Subscriptions',
    desc: 'Upgrades, downgrades and cancellations, prorated.',
    href: `${CURRENT}/subscriptions/list-subscriptions`,
  },
  {
    path: '/v1/events',
    title: 'Events',
    desc: 'Ingest usage the moment it happens.',
    href: `${CURRENT}/events/ingest-events`,
  },
  {
    path: '/v1/meters',
    title: 'Meters',
    desc: 'Aggregate events into billable numbers.',
    href: `${CURRENT}/meters/list-meters`,
  },
  {
    path: '/v1/orders',
    title: 'Orders',
    desc: 'Every invoice, receipt and refund.',
    href: `${CURRENT}/orders/list-orders`,
  },
  {
    path: '/v1/metrics',
    title: 'Metrics',
    desc: 'Revenue, usage and cost over time.',
    href: `${CURRENT}/metrics/get-metrics`,
  },
  {
    path: '/v1/webhooks',
    title: 'Webhooks',
    desc: 'Signed deliveries for everything that happens.',
    href: `${CURRENT}/webhooks/list-webhook-endpoints`,
  },
]

export const Api = () => (
  <Chapter
    id="api"
    index="04"
    name="API"
    title="One REST API"
    subtitle="Everything the dashboard can do"
    description="Every resource the dashboard touches, behind versioned endpoints and organization tokens."
    cta={<DocsLink href={API_REFERENCE} label="API reference" />}
  >
    <Grid
      templateColumns={{
        base: '1fr',
        md: 'repeat(2, 1fr)',
        xl: 'repeat(4, 1fr)',
      }}
      gap="l"
    >
      {RESOURCES.map((resource) => (
        <a key={resource.path} href={resource.href}>
          <Box
            height="100%"
            flexDirection="column"
            rowGap="xl"
            padding="xl"
            backgroundColor={{
              base: 'background-secondary',
              hover: 'background-card',
            }}
            transitionProperty="colors"
            transitionDuration="fast"
          >
            <Text variant="default" color="muted" monospace>
              {resource.path}
            </Text>
            <Box flexDirection="column" rowGap="s">
              <Text variant="heading-xxs" as="h3">
                {resource.title}
              </Text>
              <Text variant="body" color="muted" wrap="pretty">
                {resource.desc}
              </Text>
            </Box>
          </Box>
        </a>
      ))}
    </Grid>
  </Chapter>
)
