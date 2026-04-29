'use client'

import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined'
import AddShoppingCartOutlined from '@mui/icons-material/AddShoppingCartOutlined'
import CardGiftcardOutlined from '@mui/icons-material/CardGiftcardOutlined'
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined'
import { CreditArc } from '../graphics/CreditArc'
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

export const CreditsPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="A wallet for your API"
        description="Customers prepay. Credits draw down as they use it."
        docsHref="/docs/features/usage-based-billing/credits"
      />

      <FeaturePageGraphic graphic={CreditArc} />

      <FeaturePageIntro>
        Customers prepay for usage. Polar deducts from the balance, then
        falls back to metered pricing if you allow it.
      </FeaturePageIntro>

      <FeatureSection title="Why prepaid feels better">
        <p>
          Pure usage billing is honest. It&apos;s also unpredictable.
          Nobody loves opening an invoice 4× the size of last month&apos;s.
        </p>
        <p>
          <strong>Credits</strong> fix that. Customers prepay for a bucket
          of usage, draw it down, and only pay again when they buy more.
        </p>
        <p>
          Underneath, credits ride on the meters you already have. Events
          deduct from the credit balance first.
        </p>
        <p>
          When the balance hits zero, you pick: charge at the metered rate,
          or block usage so the customer never pays more than they prepaid.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            icon: <CardGiftcardOutlined fontSize="large" />,
            title: 'Credits Benefit',
            description:
              'Attach credits to any product. Recurring grants on subscriptions, one-time on purchases.',
          },
          {
            icon: <AccountBalanceWalletOutlined fontSize="large" />,
            title: 'Per-meter balances',
            description:
              'Each meter carries its own balance, so different units stay isolated.',
          },
          {
            icon: <QueryStatsOutlined fontSize="large" />,
            title: 'Customer State API',
            description:
              'Read every active meter and remaining balance in a single call.',
          },
          {
            icon: <AddShoppingCartOutlined fontSize="large" />,
            title: 'Top-up purchases',
            description:
              'Sell standalone credit packs as one-time products and let customers stack them on top of an existing balance.',
          },
        ]}
      />

      <FeatureSplit
        title="Two ways to grant credits"
        description="The Credits benefit attaches to any product and refills automatically based on the product type. Add multiple Credits benefits to the same product when you want to grant credits across more than one meter."
        bullets={[
          {
            title: 'On a subscription',
            description:
              'Credits are granted at the start of every billing cycle. The same monthly plan can include 1,000 prompt-token credits and 100 image-generation credits, each tracked independently.',
          },
          {
            title: 'On a one-time purchase',
            description:
              'Credits are granted once at checkout. Sell top-ups as standalone products and let customers stack them on top of an existing balance whenever they need more.',
          },
        ]}
      />

      <FeatureRichList
        title="Reading and reasoning about balances"
        description="Polar exposes everything you need to surface the right experience to customers in your own product."
        items={[
          {
            title: 'Customer State API',
            description:
              'A single endpoint that returns every active subscription, every active meter, and the remaining balance for each meter. Perfect for the “credits remaining” widget in your app.',
          },
          {
            title: 'Customer Meters API',
            description:
              'Drill into a specific meter, see consumed and credited amounts, and inspect the underlying events that moved the balance.',
          },
          {
            title: 'Credits-only spending',
            description:
              'Set up a meter with no metered price and the customer can never be billed beyond what they prepaid. Spending stops, the API surfaces the empty balance, and you decide how your product should respond.',
          },
          {
            title: 'Customer Portal',
            description:
              'Every customer sees their meters and remaining credits in the hosted portal. They can buy more, top up, or simply check where they stand without contacting support.',
          },
        ]}
      />

      <FeatureSection title="You stay in control of enforcement">
        <p>
          Polar never blocks usage on its own.
        </p>
        <p>
          When a balance hits zero, your app decides what happens. Keep
          serving. Prompt for an upgrade. Throttle.
        </p>
        <p>
          That&apos;s deliberate. Usage rules belong inside your product,
          where the context lives.
        </p>
        <p>
          Polar&apos;s job is to keep the balance accurate, push events
          through fast, and make the next state easy to read.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Ship a prepaid plan."
        description="Sell credit packs and let usage draw them down. No custom ledger required."
      />
    </FeaturePageLayout>
  )
}
