import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import type { ComponentType } from 'react'
import { CreditArc } from './graphics/CreditArc'
import { CycleArrow } from './graphics/CycleArrow'
import { LinkedRings } from './graphics/LinkedRings'
import { VennCluster } from './graphics/VennCluster'

interface Feature {
  title: string
  desc: string
  href: string
  Graphic: ComponentType
}

const FEATURES: Feature[] = [
  {
    title: 'Usage billing',
    desc: 'Meter tokens, API calls, compute and storage down to the event.',
    href: '/features/usage-billing',
    Graphic: VennCluster,
  },
  {
    title: 'Subscriptions',
    desc: 'Recurring plans with trials, upgrades & proration built in.',
    href: '/features/subscriptions',
    Graphic: CycleArrow,
  },
  {
    title: 'Seats',
    desc: 'Add, remove and prorate seats automatically.',
    href: '/features/seats',
    Graphic: LinkedRings,
  },
  {
    title: 'Credits',
    desc: 'Prepaid balances that drain as usage flows.',
    href: '/features/credits',
    Graphic: CreditArc,
  },
]

export const FeatureCards = () => (
  <Grid
    templateColumns={{
      base: '1fr',
      md: 'repeat(2, 1fr)',
      xl: 'repeat(4, 1fr)',
    }}
    gap="l"
  >
    {FEATURES.map(({ title, desc, href, Graphic }) => (
      <Link key={title} href={href}>
        <Box
          height="100%"
          flexDirection="column"
          justifyContent="between"
          rowGap="3xl"
          padding="3xl"
          backgroundColor={{
            base: 'background-secondary',
            hover: 'background-card',
          }}
          transitionProperty="colors"
          transitionDuration="fast"
        >
          <Box display="block" aspectRatio="1 / 1">
            <Graphic />
          </Box>
          <Box flexDirection="column" rowGap="m">
            <Text variant="heading-s" as="h3">
              {title}
            </Text>
            <Text variant="heading-xxs" color="muted" wrap="pretty">
              {desc}
            </Text>
          </Box>
        </Box>
      </Link>
    ))}
  </Grid>
)
