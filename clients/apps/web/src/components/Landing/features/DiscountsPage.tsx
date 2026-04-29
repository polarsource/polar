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
        title="Discounts and promo codes"
        description="Codes, links, or API. Once, monthly, or forever."
        docsHref="/docs/features/discounts"
      />

      <FeaturePageGraphic graphic={WaveBars} />

      <FeaturePageIntro>
        Configure a discount with the right shape, the right duration, and the
        right way to apply it. The same primitive covers public promo codes,
        private partner deals, and programmatic offers from inside your product.
      </FeaturePageIntro>

      <FeatureSection title="Three knobs">
        <p>
          Every discount in Polar is built from three decisions. The first is{' '}
          <strong>shape</strong>, which sets how the discount reduces the price:
          a percentage off the order, or a fixed amount off in the
          customer&apos;s currency.
        </p>
        <p>
          The second is <strong>duration</strong>, and it only matters for
          recurring products. A discount can apply once on the next charge, for
          a fixed number of months, or forever as long as the subscription keeps
          renewing.
        </p>
        <p>
          The third is <strong>delivery</strong>, which decides who can actually
          use it. A discount can carry a code customers type at checkout, or no
          code at all so it can only be applied programmatically through a
          Checkout Link or the API. That single distinction separates a public
          Black Friday promotion from a quiet partner deal you don&apos;t want
          indexed.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            icon: <LocalOfferOutlined fontSize="large" />,
            title: 'Restrict by product',
            description:
              'Scope discounts to specific products, including ones created later.',
          },
          {
            icon: <TimerOutlined fontSize="large" />,
            title: 'Time windows',
            description:
              'Set start and end dates so the discount goes live and expires on its own.',
          },
          {
            icon: <PercentOutlined fontSize="large" />,
            title: 'Redemption limits',
            description:
              'Cap total redemptions to control how widely the discount circulates.',
          },
          {
            icon: <LinkOutlined fontSize="large" />,
            title: 'Pinned to a Checkout Link',
            description:
              'Auto-apply on a specific link without exposing a code. For partner and influencer deals.',
          },
        ]}
      />

      <FeatureSplit
        title="Three ways to apply a discount"
        description="Different campaigns need different mechanics. Polar supports all three on the same primitive, without parallel coupon systems."
        bullets={[
          {
            title: 'Auto-apply via Checkout Link',
            description:
              'Pin a discount to a Checkout Link and it applies the moment the customer lands. For promotional traffic where you want the deal guaranteed without a code.',
          },
          {
            title: 'Prefill via query parameter',
            description:
              'Add discount_code=XYZ to any Checkout Link URL and the field is filled in automatically. The customer can still see and edit the value, which is useful for tracked campaigns.',
          },
          {
            title: 'Apply via API',
            description:
              'Pass a discount when you create a Checkout Session. The reduction is calculated server-side, so programmatic deals can be tied to events in your own product.',
          },
        ]}
      />

      <FeatureRichList
        title="Recurring discounts"
        description="Discounts on subscriptions need a clear duration, so the customer always knows what they’re signing up for. Three options cover every common case."
        items={[
          {
            title: 'Once',
            description:
              'The discount applies to the next renewal only. Future invoices charge the regular price.',
          },
          {
            title: 'Several months',
            description:
              'The discount applies for a fixed number of monthly cycles, then drops off. Common for win-back offers and onboarding incentives.',
          },
          {
            title: 'Forever',
            description:
              'The discount applies for as long as the subscription renews. Useful for grandfathered customers, partner pricing, or community plans.',
          },
        ]}
      />

      <FeatureSection title="How discounts compose">
        <p>
          Discounts apply before tax, so the customer sees a single accurate
          total in the right currency at checkout. The reduction is itemized on
          every invoice and surfaced in the Customer Portal, which gives finance
          and the customer the same paper trail to point at.
        </p>
        <p>
          On the operations side, discount events fire on every order, refund,
          and renewal, so a CRM or analytics pipeline can credit the right
          campaign for any conversion without you wiring up separate tracking.
        </p>
        <p>
          Combined with redemption limits, scoped products, and time windows,
          that&apos;s enough for marketing to run a full promotion calendar
          without engineering involvement after the first setup.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Create a discount"
        description="Pick the shape, duration, and delivery."
      />
    </FeaturePageLayout>
  )
}
