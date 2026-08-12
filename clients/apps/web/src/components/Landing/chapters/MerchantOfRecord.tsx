import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { Chapter } from '../Chapter'
import { Pipeline } from '../Pipeline'

interface Aspect {
  title: string
  desc: string
  href: string
}

const ASPECTS: Aspect[] = [
  {
    title: 'Automatic invoicing',
    desc: 'Usage rolls straight into invoices and charges, with no manual billing runs.',
    href: '/docs/features/orders',
  },
  {
    title: 'Payment processing',
    desc: 'Cards, wallets, and bank debits captured and settled across 100+ markets.',
    href: '/docs/features/checkout/session',
  },
  {
    title: 'Tax collection & remittance',
    desc: 'Sales tax, VAT, and GST calculated, collected, and filed for you.',
    href: '/docs/merchant-of-record/introduction',
  },
  {
    title: 'Risk & fraud analysis',
    desc: 'Every transaction screened for fraud before it ever hits your books.',
    href: '/docs/merchant-of-record/account-reviews',
  },
  {
    title: 'Refunds & chargebacks',
    desc: 'Disputes, refunds, and usage reconciliation handled end to end.',
    href: '/docs/features/refunds',
  },
  {
    title: 'LLM usage breakdown',
    desc: 'Every model call metered token by token, per customer, across all of your providers.',
    href: '/docs/features/usage-based-billing/ingestion-strategies/llm-strategy',
  },
  {
    title: 'Margins & cashflow metrics',
    desc: 'Revenue minus cost in real time, per customer and across your whole business.',
    href: '/docs/features/analytics',
  },
  {
    title: 'Cost anomalies & insights',
    desc: 'Spot runaway spend the moment costs spike, not at month end.',
    href: '/docs/features/cost-insights/introduction',
  },
]

export const MerchantOfRecord = () => (
  <Chapter
    index="02"
    name="Sell"
    title="We are the merchant of record"
    subtitle="The liability lands on our name, not yours"
    description="Raw usage goes in. Revenue comes out."
  >
    <Grid
      templateColumns={{
        base: '1fr',
        md: 'repeat(2, 1fr)',
        xl: 'repeat(4, 1fr)',
      }}
      gap="l"
    >
      {ASPECTS.map((aspect) => (
        <Link key={aspect.title} href={aspect.href}>
          <Box
            height="100%"
            flexDirection="column"
            padding="3xl"
            backgroundColor={{
              base: 'background-secondary',
              hover: 'background-card',
            }}
            transitionProperty="colors"
            transitionDuration="fast"
          >
            <Box flexDirection="column" rowGap="m">
              <Text variant="heading-xxs" as="h3">
                {aspect.title}
              </Text>
              <Text variant="body" color="muted" wrap="pretty">
                {aspect.desc}
              </Text>
            </Box>
          </Box>
        </Link>
      ))}
    </Grid>
    <Pipeline />
  </Chapter>
)
