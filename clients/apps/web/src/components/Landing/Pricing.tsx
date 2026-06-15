'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Button, Grid } from '@polar-sh/orbit'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'
import { VolumetricSlices } from './graphics/VolumetricSlices'

type Tier = {
  name: string
  desc: string
  free?: boolean
  price?: string
  period?: string
  fees: string[]
  features: string[]
}

const TIERS: Tier[] = [
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
    features: [
      'All features on Starter',
      'Preview access to new features',
      'Prioritized support',
    ],
  },
  {
    name: 'Growth',
    price: '$100',
    period: '/month',
    desc: 'For scaling startups.',
    fees: ['3.60% + 35¢ per transaction'],
    features: [
      'All features on Pro',
      'Preview access to new features',
      'Prioritized support',
    ],
  },
  {
    name: 'Scale',
    price: '$400',
    period: '/month',
    desc: 'For fast growing businesses.',
    fees: ['3.40% + 30¢ per transaction'],
    features: [
      'All features on Growth',
      'Preview access to new features',
      'Shared Slack channel',
      'P1 Support',
    ],
  },
]

export const Pricing = () => (
  <>
    <span id="pricing" className="block scroll-mt-12 md:scroll-mt-28" />
    <Box as="section" flexDirection="column" rowGap="5xl">
      <Box flexDirection="column" rowGap="xl">
        <Text variant="heading-xl" as="h2" wrap="balance">
          Built to scale with you.
        </Text>
        <Box display="block" maxWidth="56rem">
          <Text variant="heading-xs" wrap="balance" color="muted">
            Start free. Upgrade as you grow. Enterprise needs? Let&apos;s talk.
          </Text>
        </Box>
        <Box alignItems="center" columnGap="m" paddingTop="m">
          <GetStartedButton size="default" />
          <Link href="mailto:support@polar.sh">
            <Button variant="secondary">Contact Sales</Button>
          </Link>
        </Box>
      </Box>

      <Grid
        templateColumns={{
          base: '1fr',
          sm: 'repeat(2, 1fr)',
          xl: 'repeat(3, 1fr)',
        }}
        gap="l"
      >
        {TIERS.map((tier) => (
          <TierCard key={tier.name} tier={tier} />
        ))}
        <StartupProgramCard />
      </Grid>
    </Box>
  </>
)

const StartupProgramCard = () => (
  <Grid
    column={{ base: 'auto', sm: 'span 2' }}
    templateColumns={{ base: '1fr', sm: 'subgrid' }}
    backgroundColor="background-secondary"
    overflow="hidden"
  >
    <Box alignItems="center" justifyContent="center" padding="2xl">
      <Box width="100%" aspectRatio="1 / 1">
        <VolumetricSlices />
      </Box>
    </Box>
    <Box position="relative" flexDirection="column" rowGap="xl" padding="3xl">
      <Box
        position="absolute"
        top="3rem"
        bottom="3rem"
        left={-8}
        borderLeftWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        display={{ base: 'none', sm: 'block' }}
      />
      <Box flexDirection="column" rowGap="xl">
        <Box flexDirection="column" rowGap="m">
          <Text variant="heading-s" as="h3">
            Startup Program
          </Text>
          <Box display="block">
            <Text variant="body" color="muted">
              A year on our most generous plan.
            </Text>
          </Box>
        </Box>
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-s" as="span">
            Free
          </Text>
          <Text as="span" variant="body" color="muted">
            for 12 months
          </Text>
        </Box>
      </Box>
      <CardSection label="Fees" items={['3.40% + 30¢ per transaction']} />
      <CardSection label="Features" items={['Everything on Scale']} />
      <Box display="block" paddingTop="m">
        <Link href="/startup-program" prefetch>
          <Button>Apply now</Button>
        </Link>
      </Box>
    </Box>
  </Grid>
)

const TierCard = ({ tier }: { tier: Tier }) => (
  <Box
    flexDirection="column"
    justifyContent="between"
    backgroundColor="background-secondary"
  >
    <Box flexDirection="column" rowGap="xl" padding="3xl">
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
      <CardSection label="Fees" items={tier.fees} />
      <CardSection label="Features" items={tier.features} />
    </Box>
  </Box>
)

const CardSection = ({ label, items }: { label: string; items: string[] }) => (
  <Box
    flexDirection="column"
    rowGap="s"
    paddingTop="xl"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Text variant="body" color="muted">
      {label}
    </Text>
    <Box as="ul" flexDirection="column" rowGap="s">
      {items.map((item) => (
        <Box as="li" display="flex" key={item}>
          <Text variant="body">{item}</Text>
        </Box>
      ))}
    </Box>
  </Box>
)
