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
        title="Prepaid credits on your meters"
        description="Customers prepay. Credits draw down per event."
        docsHref="/docs/features/usage-based-billing/credits"
      />

      <FeaturePageGraphic graphic={CreditArc} />

      <FeaturePageIntro>
        Customers prepay for usage and Polar deducts from the balance as events
        arrive. When the balance reaches zero, the meter falls back to your
        metered price or stops, depending on how you configure it.
      </FeaturePageIntro>

      <FeatureSection title="Why prepaid">
        <p>
          Pure usage billing is honest with the customer, but it&apos;s also
          unpredictable. Opening an invoice that&apos;s four times larger than
          last month&apos;s makes any product feel volatile, even when the
          underlying behavior is correct.
        </p>
        <p>
          <strong>Credits</strong> rebuild that predictability without giving up
          usage-based pricing. The customer prepays for a defined amount of
          usage, draws it down over time, and only pays again when they top up.
        </p>
        <p>
          Underneath, credits ride on the meters you already have. Incoming
          events deduct from the credit balance first; only when the balance
          hits zero does the metered price kick in, and even that step is
          optional.
        </p>
        <p>
          That choice is yours: charge the metered rate beyond the prepaid
          amount, or block usage entirely so the customer can never owe more
          than they paid up front.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            icon: <CardGiftcardOutlined fontSize="large" />,
            title: 'Credits Benefit',
            description:
              'Attach credits to any product. Recurring grants on subscriptions, one-time grants on purchases.',
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
            title: 'Top-up products',
            description:
              'Sell credit packs as one-time products. Customers stack them on top of an existing balance.',
          },
        ]}
      />

      <FeatureSplit
        title="Granting credits"
        description="The Credits benefit attaches to any product and refills based on the product type. Add multiple Credits benefits to one product to grant credits across more than one meter."
        bullets={[
          {
            title: 'On a subscription',
            description:
              'Credits are granted at the start of every billing cycle. A monthly plan can include 1,000 prompt-token credits and 100 image-generation credits, tracked independently.',
          },
          {
            title: 'On a one-time purchase',
            description:
              'Credits are granted once at checkout. Sell top-ups as standalone products and let customers stack them on an existing balance.',
          },
        ]}
      />

      <FeatureRichList
        title="Balances and visibility"
        description="Read balances through the API, surface them in your product, or let customers manage them directly in the portal."
        items={[
          {
            title: 'Customer State API',
            description:
              'A single endpoint that returns every active subscription, every active meter, and the remaining balance for each meter. Built for the “credits remaining” widget.',
          },
          {
            title: 'Customer Meters API',
            description:
              'Drill into a specific meter, inspect consumed and credited amounts, and read the events that moved the balance.',
          },
          {
            title: 'Credits-only spending',
            description:
              'Set up a meter with no metered price. The customer can never be billed beyond what they prepaid, and the API surfaces an empty balance for your application to handle.',
          },
          {
            title: 'Customer Portal',
            description:
              'Every customer sees their meters and remaining credits in the hosted portal. They can top up or check balance without contacting support.',
          },
        ]}
      />

      <FeatureSection title="Enforcement is yours">
        <p>
          Polar deliberately stops short of blocking usage on its own. When a
          balance hits zero, the API surfaces the empty state and your
          application decides what happens next.
        </p>
        <p>
          That separation matters because the right response is
          context-dependent. Some flows should keep serving and bill the
          overage; others should prompt for an upgrade or throttle until the
          customer tops up. Those are product decisions, not billing ones.
        </p>
        <p>
          Polar&apos;s job is to keep the balance accurate and the API current,
          so the rule you write in your code can rely on the number it reads.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Add a Credits benefit"
        description="Attach credits to a product and Polar handles the bookkeeping."
      />
    </FeaturePageLayout>
  )
}
