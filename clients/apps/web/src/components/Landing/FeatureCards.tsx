import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import type { ComponentType } from 'react'
import { CreditArc } from './graphics/CreditArc'
import { CycleArrow } from './graphics/CycleArrow'
import { VennCluster } from './graphics/VennCluster'

interface Feature {
  title: string
  desc: string
  href: string
  Graphic: ComponentType
}

const FEATURES: Feature[] = [
  {
    title: 'Usage Billing',
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
    title: 'Credits',
    desc: 'Prepaid balances that draw down with usage and top up automatically.',
    href: '/features/credits',
    Graphic: CreditArc,
  },
]

export const FeatureCards = () => (
  <Grid
    templateColumns={{
      base: '1fr',
      md: 'repeat(2, 1fr)',
      xl: 'repeat(3, 1fr)',
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
          padding={{ base: 'xl', md: '3xl' }}
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
          <Box flexDirection="column" rowGap="s">
            <Text variant="heading-xs" as="h3">
              {title}
            </Text>
            <Text variant="heading-xxs" color="muted">
              {desc}
            </Text>
          </Box>
        </Box>
      </Link>
    ))}
  </Grid>
)
