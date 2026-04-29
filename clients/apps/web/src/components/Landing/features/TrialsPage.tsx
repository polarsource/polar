'use client'

import EditCalendarOutlined from '@mui/icons-material/EditCalendarOutlined'
import HourglassTopOutlined from '@mui/icons-material/HourglassTopOutlined'
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined'
import ShieldOutlined from '@mui/icons-material/ShieldOutlined'
import { VectorField } from '../graphics/VectorField'
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

export const TrialsPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="Trials with automatic conversion"
        description="Capture the card. Convert when the trial ends."
        docsHref="/docs/features/subscriptions/trials"
      />

      <FeaturePageGraphic graphic={VectorField} />

      <FeaturePageIntro>
        Trials in Polar collect the payment method up front, defer the charge
        until the period ends, and then convert without manual intervention.
      </FeaturePageIntro>

      <FeatureSection title="How trials work">
        <p>
          When a customer checks out with a trial, the subscription is created
          in a <strong>trialing</strong> state with full access to every benefit
          on the product. The card is captured at checkout, but no money moves
          yet.
        </p>
        <p>
          When the trial period ends, Polar charges the saved card and the first
          regular billing cycle begins, all without your code in the loop. If
          the customer cancels mid-trial, no charge is ever attempted.
        </p>
        <p>
          The edge case is conversion that fails because the card declines.
          Rather than treating that as the end of the relationship, the
          subscription enters the same payment recovery flow as any past-due
          renewal, so a temporary card issue has multiple chances to resolve
          before benefits are revoked.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            icon: <HourglassTopOutlined fontSize="large" />,
            title: 'Automatic conversion',
            description:
              'When the trial ends, the subscription charges and continues. No manual step.',
          },
          {
            icon: <NotificationsActiveOutlined fontSize="large" />,
            title: 'Conversion reminders',
            description:
              'Polar emails the customer before the trial ends so the charge is expected.',
          },
          {
            icon: <ShieldOutlined fontSize="large" />,
            title: 'Abuse prevention',
            description:
              'Block repeat trial sign-ups by normalized email or payment-method fingerprint.',
          },
          {
            icon: <EditCalendarOutlined fontSize="large" />,
            title: 'Edit any trial',
            description:
              'Extend, shorten, or end a trial from the dashboard or the API.',
          },
        ]}
      />

      <FeatureSplit
        title="Configure a trial in three places"
        description="Set a default on the product. Override per Checkout Link or per Checkout Session. The most specific value wins."
        bullets={[
          {
            title: 'On the product',
            description:
              'A baseline trial that applies to every checkout for the product. Choose unit (day, week, month, year) and duration.',
          },
          {
            title: 'On a Checkout Link',
            description:
              'Override the product trial for a specific link. Useful for partner deals or campaign-specific durations.',
          },
          {
            title: 'On a Checkout Session',
            description:
              'Set the trial programmatically when you create a session. Tune length per plan, region, or referral source.',
          },
        ]}
      />

      <FeatureRichList
        title="Conversion reminders"
        description="Polar emails the customer before the trial ends so the conversion charge is expected. Reminder timing is calibrated to the trial length."
        items={[
          {
            title: 'Trials of 3 days or more',
            description: 'Reminder sent 3 days before the trial ends.',
          },
          {
            title: 'Trials of 1 to 3 days',
            description: 'Reminder sent 1 day before the trial ends.',
          },
          {
            title: 'Trials shorter than 1 day',
            description:
              'No reminder is sent. The trial is short enough that the customer is already in the product.',
          },
          {
            title: 'Optional, per organization',
            description:
              'Turn reminders off under Settings → Billing → Customer notifications if you handle conversion communication yourself.',
          },
        ]}
      />

      <FeatureSection title="Trial abuse prevention">
        <p>
          Repeat sign-ups are a common problem with trials, especially for
          products that rely on free evaluation periods to drive conversion.
          Polar offers an optional layer of detection that tracks redemptions
          across your products without any setup beyond a toggle.
        </p>
        <p>
          When <strong>Prevent trial abuse</strong> is enabled, a new checkout
          is matched against past trial redemptions on two signals: the
          customer&apos;s normalized email (so{' '}
          <strong>user+alias@example.com</strong> is treated as{' '}
          <strong>user@example.com</strong>) and the fingerprint of the payment
          method on file. A match on either blocks the trial.
        </p>
        <p>
          The customer never hits a dead end. Polar refreshes the session
          without the trial period and the regular paid checkout continues, so a
          returning user can still convert at full price.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Add a trial"
        description="Set unit and duration on the product, the Checkout Link, or the API."
      />
    </FeaturePageLayout>
  )
}
