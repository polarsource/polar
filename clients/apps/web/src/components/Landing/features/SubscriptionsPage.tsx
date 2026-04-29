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
        title="Recurring revenue, on autopilot"
        description="Renewals, proration, dunning, all handled."
        docsHref="/docs/features/subscriptions/introduction"
      />

      <FeaturePageGraphic graphic={CycleArrow} />

      <FeaturePageIntro>
        Each cycle, Polar advances the period and charges the saved card.
        If the charge fails, dunning takes over.
      </FeaturePageIntro>

      <FeatureSection title="The lifecycle, end to end">
        <p>
          A subscription starts when a customer checks out a recurring
          product. Polar issues the first order, charges the card, and grants
          every <strong>benefit</strong> on the product.
        </p>
        <p>
          From there it renews itself. New order at the start of every
          cycle, with tax and any active discount baked in. Saved payment
          method, charged automatically.
        </p>
        <p>
          Benefits stay synced with status. Active or trialing means access
          stays on. Canceled or unpaid means access drops, optionally after
          a grace period you control.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            icon: <CreditCardOutlined fontSize="large" />,
            title: 'Flexible billing',
            description:
              'Fixed, pay-what-you-want, or free recurring prices on any cadence.',
          },
          {
            icon: <TrendingUpOutlined fontSize="large" />,
            title: 'Plan changes',
            description:
              'Upgrades and downgrades with prorated charges and credits, instantly.',
          },
          {
            icon: <AutorenewOutlined fontSize="large" />,
            title: 'Failed payment recovery',
            description:
              'Smart retry logic and grace periods keep more customers paying.',
          },
          {
            icon: <AccountCircleOutlined fontSize="large" />,
            title: 'Customer Portal',
            description:
              'Subscribers update payment, swap plans, and cancel themselves, with no support tickets to triage.',
          },
        ]}
      />

      <FeatureSplit
        title="Three proration behaviors, one switch"
        description="Set a default at the organization level and override per API call when a particular change deserves different handling."
        bullets={[
          {
            title: 'Invoice immediately',
            description:
              'The plan changes now and the prorated difference is invoiced and charged on the spot. Best for upgrades where you want to collect revenue as soon as the customer commits.',
          },
          {
            title: 'Apply on next invoice',
            description:
              'The plan changes now, but the prorated difference rides along on the next renewal invoice. The smoothest experience for routine plan changes.',
          },
          {
            title: 'Apply on next period',
            description:
              'The change is scheduled and only takes effect at the start of the next billing period. No proration is issued. Safer for downgrades.',
          },
        ]}
      />

      <FeatureRichList
        title="Failed payment recovery, handled"
        description="When a renewal charge fails, Polar moves the subscription to past due and runs an automated dunning schedule before revoking anything."
        items={[
          {
            title: 'Four retries over 21 days',
            description:
              'Polar retries the charge after 2, 5, 7, and 7 days. Any successful retry returns the subscription to active and the cycle continues normally.',
          },
          {
            title: 'Customer reminders',
            description:
              'The customer is emailed at the first failure with a link to the Customer Portal so they can update their payment method without contacting support.',
          },
          {
            title: 'Configurable grace period',
            description:
              'Choose whether benefits are revoked immediately or after 2, 7, 14, or 21 days. Keeps paying customers from being locked out by a single expired card.',
          },
          {
            title: 'Long-cycle renewal reminders',
            description:
              'For subscriptions on cycles of six months or more, Polar emails the customer 7 days before renewal so an annual charge is never a surprise.',
          },
        ]}
      />

      <FeatureSection title="Self-service from day one">
        <p>
          Every account ships with a hosted{' '}
          <strong>Customer Portal</strong>. Update payment methods, download
          invoices, change plans, manage seats, cancel.
        </p>
        <p>
          Send customers there with a one-click link, or embed it in your
          product.
        </p>
        <p>
          <strong>Cancel at period end</strong> keeps benefits live until
          the paid term runs out, and is reversible.{' '}
          <strong>Revoke immediately</strong> ends access right away.
        </p>
        <p>
          Both work from the dashboard, the API, and the portal.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Launch subscriptions today."
        description="Connect a product, set a recurring price, and start billing in minutes."
      />
    </FeaturePageLayout>
  )
}
