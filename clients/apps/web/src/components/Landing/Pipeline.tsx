'use client'

import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useState } from 'react'

const ArrowRight = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

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
    display="flex"
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
    display="flex"
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
  <Box
    display="flex"
    justifyContent="center"
    color="text-tertiary"
    paddingVertical="m"
  >
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

const Chevron = ({ open }: { open: boolean }) => (
  <Box color="text-tertiary" display="flex" flexShrink={0}>
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 150ms ease',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </Box>
)

export const Pipeline = () => {
  const [active, setActive] = useState(0)

  return (
    <Box
      position="relative"
      display="flex"
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
        <Box as="ul" display="flex" flexDirection="column" rowGap="2xl">
          <Box display="flex" flexDirection="column" rowGap="2xl">
            <Text variant="heading-l" as="h2" wrap="balance">
              Everything between usage & revenue
            </Text>
            <Text variant="heading-xxs" color="muted" wrap="pretty">
              Usage goes in, settled revenue goes out to your bank account. In
              between, Polar handles billing, invoicing, metrics, tax, payments
              & fraud as your merchant of record.
            </Text>
          </Box>

          <Box display={{ base: 'none', md: 'flex' }} flexDirection="column">
            {ASPECTS.map((aspect, index) => {
              const open = index === active
              return (
                <Box
                  as="li"
                  key={aspect.title}
                  borderBottomWidth={1}
                  borderStyle="solid"
                  borderColor="border-secondary"
                  paddingVertical="xl"
                  display="flex"
                  flexDirection="column"
                  rowGap="l"
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="between"
                    columnGap="l"
                    cursor="pointer"
                    onClick={() => setActive(index)}
                  >
                    <Box display="flex" flexDirection="row" columnGap="s">
                      <Text
                        variant="heading-xxs"
                        color={open ? undefined : 'muted'}
                      >
                        {aspect.title}
                      </Text>
                    </Box>
                    <Chevron open={open} />
                  </Box>
                  {open && (
                    <Box
                      paddingBottom="l"
                      display="flex"
                      flexDirection="column"
                      rowGap="m"
                    >
                      <Text variant="body" color="muted">
                        {aspect.desc}
                      </Text>
                      <Link href={aspect.href}>
                        <Box
                          display="flex"
                          alignItems="center"
                          columnGap="m"
                          width="fit-content"
                          color={{
                            base: 'text-primary',
                            hover: 'text-secondary',
                          }}
                          cursor="pointer"
                        >
                          <Text variant="body">Learn more</Text>
                          <ArrowRight />
                        </Box>
                      </Link>
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Flow */}
        <Box
          width="100%"
          maxWidth={{ base: '100%' }}
          marginHorizontal="auto"
          display="flex"
          flexDirection="column"
          paddingVertical={{ base: '2xl', md: '5xl' }}
          paddingHorizontal={{ base: '2xl', md: '5xl' }}
          rowGap="xl"
          borderWidth={1}
          borderColor="border-secondary"
        >
          {/* Customer */}
          <Box
            display="flex"
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
            <Box display="flex" flexDirection="column">
              <Text>John Doe</Text>
              <Text color="muted">Consumed 23,820 tokens</Text>
            </Box>
          </Box>

          <ArrowDown />

          {/* Polar */}
          <Box display="flex" flexDirection="column" rowGap="s">
            <Box
              paddingVertical="m"
              display="flex"
              justifyContent="center"
              backgroundColor="background-secondary"
            >
              <Text variant="body">Polar</Text>
            </Box>
            {GROUPS.map((group, groupIndex) => (
              <Box
                key={groupIndex}
                display="flex"
                flexDirection="column"
                backgroundColor="background-secondary"
                padding="s"
              >
                {group.map((aspect) => {
                  const globalIndex = ASPECTS.indexOf(aspect)
                  const isActive = globalIndex === active
                  return (
                    <Box
                      key={aspect.title}
                      display="flex"
                      alignItems="center"
                      columnGap="l"
                      paddingVertical="s"
                      paddingHorizontal="s"
                      cursor="pointer"
                      onClick={() => setActive(globalIndex)}
                    >
                      <CheckIcon active={isActive} />
                      <Text
                        variant="body"
                        color={isActive ? undefined : 'muted'}
                      >
                        {aspect.title}
                      </Text>
                    </Box>
                  )
                })}
              </Box>
            ))}
          </Box>

          <ArrowDown />

          {/* Payout */}
          <Box
            display="flex"
            alignItems="center"
            columnGap="l"
            backgroundColor="background-secondary"
            padding="l"
          >
            <BankIcon />
            <Box display="flex" flexDirection="column" rowGap="xs">
              <Box display="flex" alignItems="baseline" columnGap="s">
                <Text>Merchant Payout</Text>
                <Text color="muted">Acme Inc</Text>
              </Box>
              <Box display="flex" alignItems="baseline" columnGap="s">
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
