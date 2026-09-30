'use client'

import { ConcentricDraw } from '../graphics/ConcentricDraw'
import {
  FeatureCardGrid,
  FeatureCTA,
  FeatureHighlight,
  FeaturePageHeader,
  FeaturePageIntro,
  FeaturePageLayout,
  FeatureRichList,
  FeatureSection,
  FeatureSplit,
} from './FeaturePageLayout'

export const FinancePage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        graphic={ConcentricDraw}
        title="Money in, money out"
        description="Balance, ledger, fees, and payouts."
        docsHref="/docs/features/finance/balance"
      />

      <FeaturePageIntro>
        Every order, refund, fee, and payout is recorded on a single page, with
        each fee shown next to the entry that triggered it. Nothing is hidden,
        including the fees we pass through from Stripe.
      </FeaturePageIntro>

      <FeatureSection title="The ledger">
        <p>
          Your <FeatureHighlight>Finance</FeatureHighlight> page tracks earnings
          net of VAT (which is captured for remittance) and net of our revenue
          share. The number you see at the top is the amount actually available
          for payout.
        </p>
        <p>
          Below the balance, every transaction sits in chronological order with
          the associated fees broken out next to it. The same data is exposed
          through the API, so accounting tools can pull the equivalent ledger
          without screen-scraping the dashboard.
        </p>
        <p>
          Multi-currency orders are converted to USD at the rate at the time of
          the transaction, which keeps your settlement currency stable even if
          your customer base is global.
        </p>
        <p>
          Payouts are deliberately manual. Polar never sweeps your balance
          automatically, so you control when money moves to your connected
          account.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            title: 'Live balance',
            description:
              'See exactly what is payable right now, net of every fee.',
          },
          {
            title: 'Transactions ledger',
            description:
              'Every order, refund, dispute, and fee in chronological order.',
          },
          {
            title: 'Manual payouts',
            description: 'Withdraw on your schedule. No automatic transfers.',
          },
          {
            title: 'Transparent fees',
            description:
              'Every fee shown next to the transaction that triggered it.',
          },
        ]}
      />

      <FeatureSplit
        title="Payouts"
        description="Connect a payout account once, then withdraw whenever your balance is ready."
        bullets={[
          {
            title: 'Stripe Connect Express',
            description:
              'The default and recommended option. Instant transfers in supported regions.',
          },
          {
            title: 'Manual control',
            description:
              'You decide when to withdraw, which makes reconciliation simpler.',
          },
          {
            title: 'Multi-currency settlement',
            description:
              'Customers pay in their currency. Polar settles to USD on your account.',
          },
          {
            title: 'Currency thresholds',
            description:
              'Stripe enforces minimum payout amounts per currency. Anything under the minimum stays on your balance until the next payout.',
          },
        ]}
      />

      <FeatureRichList
        title="Fees, end to end"
        description="The platform fee varies by plan (Starter: 5% + 50¢, down to 3.4% + 30¢ on Scale). Card-network and Stripe extras are passed through transparently, never hidden inside the platform fee."
        items={[
          {
            title: 'Platform fee',
            description:
              'Varies by plan. Starter is 5% + 50¢; paid plans (Pro, Growth, Scale) offer lower rates. See the pricing guide for details.',
          },
          {
            title: 'International cards',
            description:
              '+1.5% when the buyer pays with a non-US card. A pass-through from Stripe.',
          },
          {
            title: 'Subscription payments',
            description:
              'No surcharge on recurring charges. Subscription payments are billed at the same rate as one-off payments.',
          },
          {
            title: 'Refunds',
            description:
              'Issue full or partial refunds anytime. Original transaction fees are not returned by the networks, so they remain deducted.',
          },
          {
            title: 'Disputes',
            description:
              '$15 per dispute. Polar may proactively refund up to 60 days after purchase to keep this number down.',
          },
        ]}
      />

      <FeatureCTA
        title="Set up payouts"
        description="Connect a payout account."
      />
    </FeaturePageLayout>
  )
}
