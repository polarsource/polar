'use client'

import LinkOutlined from '@mui/icons-material/LinkOutlined'
import LocalOfferOutlined from '@mui/icons-material/LocalOfferOutlined'
import PercentOutlined from '@mui/icons-material/PercentOutlined'
import TimerOutlined from '@mui/icons-material/TimerOutlined'
import { WaveBars } from '../graphics/WaveBars'
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

export const DiscountsPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="Promo codes that pay off"
        description="Codes, links, or API. Once, monthly, or forever."
        docsHref="/docs/features/discounts"
      />

      <FeaturePageGraphic graphic={WaveBars} />

      <FeaturePageIntro>
        Codes, links, or API. Once, several months, or forever. Polar
        handles every shape of promotion.
      </FeaturePageIntro>

      <FeatureSection title="Three knobs cover every promotion">
        <p>
          <strong>Shape.</strong> Percentage off or fixed amount off, in
          the customer&apos;s currency.
        </p>
        <p>
          <strong>Duration.</strong> Once on the next charge, for a fixed
          number of months, or forever as the subscription renews.
        </p>
        <p>
          <strong>Delivery.</strong> A discount can carry a code customers
          type at checkout, or no code so it only applies via link or API.
        </p>
        <p>
          That distinction alone separates a public Black Friday code from
          a quiet partner deal you don&apos;t want indexed.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            icon: <LocalOfferOutlined fontSize="large" />,
            title: 'Restrict by product',
            description:
              'Scope discounts to a subset of products, including ones created later.',
          },
          {
            icon: <TimerOutlined fontSize="large" />,
            title: 'Time windows',
            description:
              'Set start and end dates so a discount goes live and expires on its own.',
          },
          {
            icon: <PercentOutlined fontSize="large" />,
            title: 'Redemption limits',
            description:
              'Cap total redemptions to keep promotions and partner deals controlled.',
          },
          {
            icon: <LinkOutlined fontSize="large" />,
            title: 'Pinned to a Checkout Link',
            description:
              'Auto-apply a discount on a specific link without exposing a code, perfect for partner and influencer deals.',
          },
        ]}
      />

      <FeatureSplit
        title="Three ways to apply a discount"
        description="Different campaigns deserve different mechanics. Polar supports all of them on the same primitive, so you don&apos;t have to maintain parallel coupon systems."
        bullets={[
          {
            title: 'Auto-apply via Checkout Link',
            description:
              'Pin a discount to a Checkout Link so it’s applied the moment a customer lands. Best for promotional traffic where you want the deal guaranteed without a code.',
          },
          {
            title: 'Prefill via query parameter',
            description:
              'Add discount_code=XYZ to any Checkout Link URL and the field is filled in automatically. The customer can still see and edit it, which is great for tracked campaigns.',
          },
          {
            title: 'Apply via API',
            description:
              'Pass a discount when you create a Checkout Session and it’s baked into the calculation server-side. Ideal for programmatic deals tied to events in your own product.',
          },
        ]}
      />

      <FeatureRichList
        title="Recurring discounts, modeled honestly"
        description="Discounts on subscriptions need to express how long the deal lasts. Polar gives you exactly three options so the customer always knows what they’re signing up for."
        items={[
          {
            title: 'Once',
            description:
              'The discount applies to the next renewal only. The first charge or the very next invoice is reduced; future invoices charge the regular price.',
          },
          {
            title: 'Several months',
            description:
              'The discount applies for a fixed number of monthly cycles, then drops off. Common for win-back offers and onboarding incentives that taper.',
          },
          {
            title: 'Forever',
            description:
              'The discount applies for as long as the subscription renews. Useful for grandfathered customers, partner pricing, or community plans you want to honor indefinitely.',
          },
        ]}
      />

      <FeatureSection title="Built into the rest of the stack">
        <p>
          Discounts apply before tax. The customer sees the right total in
          the right currency.
        </p>
        <p>
          They show up on invoices and in the Customer Portal. Finance
          gets a paper trail.
        </p>
        <p>
          Webhooks fire at every interesting moment. Your CRM or
          analytics pipeline credits the right campaign.
        </p>
        <p>
          Add redemption limits, scoped products, and time windows, and
          marketing can run the calendar without writing code.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Run smarter promotions."
        description="Spin up discount codes for any campaign, without writing your own coupon engine."
      />
    </FeaturePageLayout>
  )
}
