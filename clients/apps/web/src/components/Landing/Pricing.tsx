'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'

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
    features: ['All features to sell', 'Standard Support'],
  },
  {
    name: 'Pro',
    price: '$20',
    period: '/month',
    desc: 'For builders & early teams.',
    fees: ['3.80% + 40¢ per transaction'],
    features: ['All features on Starter', 'Prioritized Support'],
  },
  {
    name: 'Growth',
    price: '$100',
    period: '/month',
    desc: 'For scaling startups.',
    fees: ['3.60% + 35¢ per transaction'],
    features: ['All features on Pro', 'Prioritized Support'],
  },
  {
    name: 'Scale',
    price: '$400',
    period: '/month',
    desc: 'For fast growing businesses.',
    fees: ['3.40% + 30¢ per transaction'],
    features: ['All features on Growth', 'Slack Channel', 'P1 Support'],
  },
]

export const Pricing = () => (
  <>
    <span id="pricing" className="block scroll-mt-12 md:scroll-mt-28" />
    <Box as="section" display="flex" flexDirection="column" rowGap="5xl">
      <Box display="flex" flexDirection="column" rowGap="xl">
        <Text variant="heading-xl" as="h2" wrap="balance">
          Built to scale with you.
        </Text>
        <Box maxWidth="56rem">
          <Text variant="heading-xs" wrap="balance" color="muted">
            Start free. Upgrade as you grow. Enterprise needs? Let&apos;s talk.
          </Text>
        </Box>
        <Box display="flex" alignItems="center" columnGap="m" paddingTop="m">
          <GetStartedButton size="default" />
          <Link href="mailto:support@polar.sh">
            <Button variant="secondary">Contact Sales</Button>
          </Link>
        </Box>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{
          base: '1fr',
          sm: 'repeat(2, 1fr)',
          xl: 'repeat(4, 1fr)',
        }}
        gap="l"
      >
        {TIERS.map((tier) => (
          <TierCard key={tier.name} tier={tier} />
        ))}
      </Box>
    </Box>
  </>
)

const TierCard = ({ tier }: { tier: Tier }) => (
  <Box
    display="flex"
    flexDirection="column"
    justifyContent="between"
    backgroundColor="background-secondary"
  >
    <Box display="flex" flexDirection="column" rowGap="xl" padding="2xl">
      <Box display="flex" flexDirection="column" rowGap="xl">
        <Box display="flex" flexDirection="column" rowGap="m">
          <Text variant="heading-s" as="h3">
            {tier.name}
          </Text>
          <Box>
            <Text variant="body" color="muted">
              {tier.desc}
            </Text>
          </Box>
        </Box>
        <Box display="flex" alignItems="baseline" columnGap="m">
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
    display="flex"
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
    <Box as="ul" display="flex" flexDirection="column" rowGap="s">
      {items.map((item) => (
        <Box as="li" display="flex" key={item}>
          <Text variant="body">{item}</Text>
        </Box>
      ))}
    </Box>
  </Box>
)
