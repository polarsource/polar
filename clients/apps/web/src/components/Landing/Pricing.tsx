'use client'

import { CheckOutlined } from '@polar-sh/orbit/icons'
import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'
import { Chapter } from './Chapter'
import { Sheet, Window } from './story/Frame'

export type Tier = {
  name: string
  desc: string
  free?: boolean
  price?: string
  period?: string
  fees: string[]
  features: string[]
}

export const TIERS: Tier[] = [
  {
    name: 'Starter',
    free: true,
    desc: 'For validating ideas.',
    fees: ['5.00% + 50¢ per transaction'],
    features: ['All features to sell', 'Standard support'],
  },
  {
    name: 'Pro',
    price: '$20',
    period: '/month',
    desc: 'For builders & early teams.',
    fees: ['3.80% + 40¢ per transaction'],
    features: ['Preview access to new features', 'Prioritized support'],
  },
  {
    name: 'Growth',
    price: '$100',
    period: '/month',
    desc: 'For scaling startups.',
    fees: ['3.60% + 35¢ per transaction'],
    features: ['Preview access to new features', 'Prioritized support'],
  },
  {
    name: 'Scale',
    price: '$400',
    period: '/month',
    desc: 'For fast growing businesses.',
    fees: ['3.40% + 30¢ per transaction'],
    features: [
      'Preview access to new features',
      'Shared Slack channel',
      'P1 Support',
      'Single Sign-On',
    ],
  },
] as const

export const Pricing = () => (
  <>
    <span id="pricing" className="block scroll-mt-12 md:scroll-mt-28" />
    <Chapter
      index="05"
      name="Pricing"
      title="Pricing that scales with you"
      subtitle="Start free, upgrade as you grow"
      cta={
        <>
          <GetStartedButton size="default" />
          <Link href="mailto:support@polar.sh">
            <Button variant="secondary">Contact Sales</Button>
          </Link>
        </>
      }
    >
      <Window flow={2} bare aside="Start free, upgrade as you grow">
        <Grid
          templateColumns={{
            base: '1fr',
            md: 'repeat(2, 1fr)',
            xl: 'repeat(4, 1fr)',
          }}
          gap="xs"
        >
          {TIERS.map((tier) => (
            <TierSheet key={tier.name} tier={tier} />
          ))}
        </Grid>
      </Window>
    </Chapter>
  </>
)

/** A tier as a sheet in the Polar window: price and fee as lines, its features anchored at the bottom. */
export const TierSheet = ({ tier }: { tier: Tier }) => (
  <Sheet
    large
    title={tier.name}
    aside={
      <Text variant="default" color="muted">
        {tier.desc.replace(/\.$/, '')}
      </Text>
    }
  >
    <Box alignItems="baseline" columnGap="s">
      <Text variant="heading-s" tabularNums>
        {tier.free ? 'Free' : tier.price}
      </Text>
      {tier.period ? (
        <Text variant="body" color="muted">
          {tier.period}
        </Text>
      ) : null}
    </Box>
    <Box flexDirection="column" rowGap="s">
      {tier.fees.map((fee) => (
        <Box
          key={fee}
          justifyContent="between"
          alignItems="baseline"
          columnGap="l"
        >
          <Text variant="body" color="muted">
            Transaction fee
          </Text>
          <Text variant="body" tabularNums>
            {fee.replace(' per transaction', '')}
          </Text>
        </Box>
      ))}
    </Box>
    <div className="mt-auto pt-8" />
    <Box
      as="ul"
      paddingTop="l"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      flexDirection="column"
      rowGap="s"
    >
      {tier.features.map((feature) => (
        <Box
          as="li"
          key={feature}
          display="flex"
          alignItems="center"
          columnGap="s"
        >
          <CheckOutlined fontSize="inherit" />
          <Text variant="body">{feature}</Text>
        </Box>
      ))}
    </Box>
  </Sheet>
)
