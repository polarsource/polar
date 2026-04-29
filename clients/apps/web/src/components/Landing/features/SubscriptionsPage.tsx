'use client'

import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined'
import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined'
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import { CycleArrow } from '../graphics/CycleArrow'
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

export const SubscriptionsPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="Subscriptions, end to end"
        description="Renewals, proration, dunning, and benefits."
        docsHref="/docs/features/subscriptions/introduction"
      />

      <FeaturePageGraphic graphic={CycleArrow} />

      <FeaturePageIntro>
        At the close of each cycle, Polar advances the period and charges the
        saved card. If the charge fails, the subscription enters payment
        recovery before anything is revoked.
      </FeaturePageIntro>

      <FeatureSection title="How a subscription works">
        <p>
          A subscription is created the moment a customer checks out a product
          with a recurring price. Polar issues the first order, collects the
          first payment, and grants every <strong>benefit</strong> attached to
          the product.
        </p>
        <p>
          From that point on, the subscription advances itself. At the end of
          every cycle, Polar generates a new order with tax and any active
          discount applied, then charges the saved payment method without your
          code in the loop.
        </p>
        <p>
          Benefits track the subscription&apos;s state throughout. While
          it&apos;s active or trialing, the customer keeps access; when it moves
          to canceled or unpaid, benefits are revoked, optionally after a grace
          period you control.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            icon: <CreditCardOutlined fontSize="large" />,
            title: 'Flexible pricing',
            description:
              'Fixed, pay-what-you-want, or free recurring prices on any cadence.',
          },
          {
            icon: <TrendingUpOutlined fontSize="large" />,
            title: 'Plan changes',
            description:
              'Upgrades and downgrades with prorated charges and credits.',
          },
          {
            icon: <AutorenewOutlined fontSize="large" />,
            title: 'Payment recovery',
            description:
              'Automatic retries on past_due with optional grace periods.',
          },
          {
            icon: <AccountCircleOutlined fontSize="large" />,
            title: 'Customer Portal',
            description:
              'Subscribers update payment, change plans, and cancel from a hosted page.',
          },
        ]}
      />

      <FeatureSplit
        title="Three proration behaviors"
        description="Set a default at the organization level. Override per API call when a particular change deserves different handling."
        bullets={[
          {
            title: 'Invoice immediately',
            description:
              'The plan changes now and the prorated difference is invoiced and charged in the same call. For upgrades, when you want the revenue immediately.',
          },
          {
            title: 'Apply on next invoice',
            description:
              'The plan changes now, but the prorated difference rides along on the next renewal invoice. The default for routine plan changes.',
          },
          {
            title: 'Apply on next period',
            description:
              'The change is scheduled and only takes effect at the start of the next billing period. No proration is issued. Safer for downgrades.',
          },
        ]}
      />

      <FeatureRichList
        title="Payment recovery"
        description="When a renewal charge fails, the subscription moves to past_due and Polar runs a four-attempt retry schedule before revoking benefits."
        items={[
          {
            title: 'Four retries over 21 days',
            description:
              'Polar retries the charge after 2, 5, 7, and 7 days. A successful retry restores the subscription to active.',
          },
          {
            title: 'Customer reminders',
            description:
              'The customer is emailed at the first failure with a link to the Customer Portal so they can update their payment method.',
          },
          {
            title: 'Configurable grace period',
            description:
              'Choose whether benefits are revoked immediately or after 2, 7, 14, or 21 days. Keeps paying customers from being locked out by a single declined card.',
          },
          {
            title: 'Long-cycle renewal reminders',
            description:
              'For subscriptions on cycles of six months or more, the customer is emailed 7 days before renewal.',
          },
        ]}
      />

      <FeatureSection title="The Customer Portal">
        <p>
          Every Polar account includes a hosted <strong>Customer Portal</strong>{' '}
          where subscribers can update payment methods, download invoices,
          change plans, manage seats, and cancel. You can either link to it
          directly or embed it inside your product.
        </p>
        <p>
          Cancellation comes in two flavors that work the same way from the
          dashboard, the API, and the portal.{' '}
          <strong>Cancel at period end</strong> keeps benefits live until the
          paid term runs out and is reversible until the end date.{' '}
          <strong>Revoke immediately</strong> ends access on the spot and
          isn&apos;t reversible.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Connect a recurring product"
        description="Set a recurring price on a product and Polar runs the rest of the lifecycle."
      />
    </FeaturePageLayout>
  )
}
