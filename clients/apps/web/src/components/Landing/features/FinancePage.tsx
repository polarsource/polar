'use client'

import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined'
import OutboundOutlined from '@mui/icons-material/OutboundOutlined'
import PriceCheckOutlined from '@mui/icons-material/PriceCheckOutlined'
import ReceiptOutlined from '@mui/icons-material/ReceiptOutlined'
import { ConcentricDraw } from '../graphics/ConcentricDraw'
import {
  FeatureCardGrid,
  FeatureCTA,
  FeaturePageGraphic,
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
        title="Money in, money out"
        description="Balance, ledger, fees, and payouts."
        docsHref="/docs/features/finance/balance"
      />

      <FeaturePageGraphic graphic={ConcentricDraw} />

      <FeaturePageIntro>
        Every order, refund, fee, and payout is recorded on a single page, with
        each fee shown next to the entry that triggered it. Nothing is hidden,
        including the fees we pass through from Stripe.
      </FeaturePageIntro>

      <FeatureSection title="The ledger">
        <p>
          Your <strong>Finance</strong> page tracks earnings net of VAT (which
          is captured for remittance) and net of our revenue share. The number
          you see at the top is the amount actually available for payout.
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
            icon: <AccountBalanceOutlined fontSize="large" />,
            title: 'Live balance',
            description:
              'See exactly what is payable right now, net of every fee.',
          },
          {
            icon: <ReceiptOutlined fontSize="large" />,
            title: 'Transactions ledger',
            description:
              'Every order, refund, dispute, and fee in chronological order.',
          },
          {
            icon: <OutboundOutlined fontSize="large" />,
            title: 'Manual payouts',
            description: 'Withdraw on your schedule. No automatic transfers.',
          },
          {
            icon: <PriceCheckOutlined fontSize="large" />,
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
        description="The platform fee is a flat 4% + 40¢. Card-network and Stripe extras are passed through transparently, never hidden inside the platform fee."
        items={[
          {
            title: 'Platform fee',
            description:
              "4% + 40¢ on the full transaction amount. Polar covers Stripe's 2.9% + 30¢ from this.",
          },
          {
            title: 'International cards',
            description:
              '+1.5% when the buyer pays with a non-US card. A pass-through from Stripe.',
          },
          {
            title: 'Subscription payments',
            description:
              '+0.5% on recurring charges. A pass-through from Stripe.',
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
