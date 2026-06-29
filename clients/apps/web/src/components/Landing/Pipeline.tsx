'use client'

import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

interface Aspect {
  title: string
  desc: string
  href: string
}

const ASPECTS: Aspect[] = [
  {
    title: 'Customer invoiced automatically',
    desc: 'Usage rolls straight into invoices and charges, with no manual billing runs.',
    href: '/docs/features/orders',
  },
  {
    title: 'LLM Usage Breakdown',
    desc: 'Every model call metered token by token, per customer, across all of your providers.',
    href: '/docs/features/usage-based-billing/ingestion-strategies/llm-strategy',
  },
  {
    title: 'Margins, Profits & Cashflow Metrics',
    desc: 'Revenue minus cost in real time, per customer and across your whole business.',
    href: '/docs/features/analytics',
  },
  {
    title: 'Cost Anomalies & Insights',
    desc: 'Spot runaway spend and unprofitable customers the moment costs spike, not at month end.',
    href: '/docs/features/cost-insights/introduction',
  },
  {
    title: 'Tax Collection & Remittance',
    desc: 'Sales tax, VAT, and GST calculated, collected, and filed for you as merchant of record.',
    href: '/docs/merchant-of-record/introduction',
  },
  {
    title: 'Payment Processing',
    desc: 'Cards, wallets, and bank debits captured and settled across 100+ markets.',
    href: '/docs/features/checkout/session',
  },
  {
    title: 'Refunds & Chargebacks',
    desc: 'Disputes, refunds, and usage reconciliation handled end to end.',
    href: '/docs/features/refunds',
  },
  {
    title: 'Risk Analysis & Fraud',
    desc: 'Every transaction screened for fraud before it ever hits your books.',
    href: '/docs/merchant-of-record/account-reviews',
  },
]

const GROUPS = [ASPECTS.slice(0, 4), ASPECTS.slice(4)]

const CheckIcon = ({ active }: { active: boolean }) => (
  <Box
    width="1.5rem"
    height="1.5rem"
    borderRadius="full"
    backgroundColor="background-success"
    color="text-success"
    alignItems="center"
    justifyContent="center"
    flexShrink={0}
    opacity={active ? 1 : 0.4}
  >
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  </Box>
)

const BankIcon = () => (
  <Box
    width="3rem"
    height="3rem"
    borderRadius="full"
    backgroundColor="background-card"
    color="text-secondary"
    alignItems="center"
    justifyContent="center"
    flexShrink={0}
  >
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="6" y1="18" x2="6" y2="11" />
      <line x1="10" y1="18" x2="10" y2="11" />
      <line x1="14" y1="18" x2="14" y2="11" />
      <line x1="18" y1="18" x2="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </svg>
  </Box>
)

const ArrowDown = () => (
  <Box justifyContent="center" color="text-tertiary" paddingVertical="m">
    <svg
      width="20"
      height="30"
      viewBox="0 0 20 30"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="10" y1="2" x2="10" y2="26" />
      <polyline points="3 19 10 26 17 19" />
    </svg>
  </Box>
)

export const Pipeline = () => {
  return (
    <Box
      position="relative"
      flexDirection="column"
      rowGap={{ base: '2xl', md: '4xl' }}
      paddingTop={{ base: 'l', md: '3xl' }}
      paddingBottom={{ base: '2xl', md: '4xl' }}
    >
      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', lg: '1fr 1fr' }}
        gap={{ base: '2xl', lg: '4xl' }}
        alignItems="center"
      >
        {/* Accordion */}
        <Box flexDirection="column" rowGap="2xl">
          <Box flexDirection="column" rowGap="2xl">
            <Text variant="heading-l" as="h2" wrap="balance">
              Everything between usage & revenue
            </Text>
            <Text variant="heading-xxs" wrap="balance" color="muted">
              Raw usage goes in. Revenue comes out. We handle everything in
              between.
            </Text>
          </Box>
        </Box>

        {/* Flow */}
        <Box
          width="100%"
          maxWidth={{ base: '100%' }}
          marginHorizontal="auto"
          flexDirection="column"
          paddingVertical={{ base: '2xl', md: '5xl' }}
          paddingHorizontal={{ base: '2xl', md: '5xl' }}
          rowGap="xl"
          borderWidth={1}
          borderColor="border-secondary"
        >
          {/* Customer */}
          <Box
            alignItems="center"
            columnGap="m"
            backgroundColor="background-secondary"
            padding="l"
          >
            <Avatar
              name="John Doe"
              avatar_url="/assets/team/emil.png"
              className="h-10 w-10 text-sm"
            />
            <Box flexDirection="column">
              <Text>John Doe</Text>
              <Text color="muted">Consumed 23,820 tokens</Text>
            </Box>
          </Box>

          <ArrowDown />

          {/* Polar */}
          <Box flexDirection="column" rowGap="s">
            <Box
              paddingVertical="m"
              justifyContent="center"
              backgroundColor="background-secondary"
            >
              <Text variant="body">Polar</Text>
            </Box>
            {GROUPS.map((group, groupIndex) => (
              <Box
                key={groupIndex}
                flexDirection="column"
                backgroundColor="background-secondary"
                padding="s"
              >
                {group.map((aspect) => {
                  return (
                    <Box
                      key={aspect.title}
                      alignItems="center"
                      columnGap="l"
                      paddingVertical="s"
                      paddingHorizontal="s"
                      cursor="pointer"
                    >
                      <CheckIcon active={true} />
                      <Text variant="body">{aspect.title}</Text>
                    </Box>
                  )
                })}
              </Box>
            ))}
          </Box>

          <ArrowDown />

          {/* Payout */}
          <Box
            alignItems="center"
            columnGap="l"
            backgroundColor="background-secondary"
            padding="l"
          >
            <BankIcon />
            <Box flexDirection="column" rowGap="xs">
              <Box alignItems="baseline" columnGap="s">
                <Text>Merchant Payout</Text>
                <Text color="muted">Acme Inc</Text>
              </Box>
              <Box alignItems="baseline" columnGap="s">
                <Text color="success">$9,311</Text>
                <Text color="muted">SEB **** 9128</Text>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
