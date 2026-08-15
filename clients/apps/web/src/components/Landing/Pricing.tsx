'use client'

import CheckOutlined from '@mui/icons-material/CheckOutlined'
import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'
import { Chapter } from './Chapter'

type Tier = {
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
    desc: 'Free to start validating ideas.',
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
      description="No hidden fees. Enterprise needs? Let's talk."
      cta={
        <>
          <GetStartedButton size="default" />
          <Link href="mailto:support@polar.sh">
            <Button variant="secondary">Contact Sales</Button>
          </Link>
        </>
      }
    >
      <Grid
        templateColumns={{
          base: '1fr',
          sm: 'repeat(2, 1fr)',
          xl: 'repeat(4, 1fr)',
        }}
        gap="l"
      >
        {TIERS.map((tier) => (
          <TierCard key={tier.name} tier={tier} />
        ))}
      </Grid>
    </Chapter>
  </>
)

const TierCard = ({ tier }: { tier: Tier }) => (
  <Box
    flexDirection="column"
    justifyContent="between"
    backgroundColor="background-secondary"
  >
    <Box flexDirection="column" rowGap="xl" padding="2xl">
      <Box flexDirection="column" rowGap="xl">
        <Box flexDirection="column" rowGap="m">
          <Text variant="heading-s" as="h3">
            {tier.name}
          </Text>
          <Box display="block">
            <Text variant="body" color="muted">
              {tier.desc}
            </Text>
          </Box>
        </Box>
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-s" as="span">
            {tier.free ? 'Free' : tier.price}
          </Text>
          {tier.period && (
            <Text as="span" variant="body" color="muted">
              {tier.period}
            </Text>
          )}
        </Box>
      </Box>
      <CardSection items={tier.fees} />
      <CardSection items={tier.features} check />
    </Box>
  </Box>
)

export const CardSection = ({
  label,
  items,
  check,
}: {
  label?: string
  items: string[]
  check?: boolean
}) => (
  <Box
    flexDirection="column"
    rowGap="s"
    paddingTop="xl"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    {label ? (
      <Text variant="body" color="muted">
        {label}
      </Text>
    ) : null}
    <Box as="ul" flexDirection="column" rowGap="s">
      {items.map((item) => (
        <Box
          as="li"
          display="flex"
          key={item}
          alignItems="center"
          columnGap="s"
        >
          {check ? <CheckOutlined fontSize="inherit" /> : null}
          <Text variant="body">{item}</Text>
        </Box>
      ))}
    </Box>
  </Box>
)
