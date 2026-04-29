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
        title="Free trials that convert themselves"
        description="Capture the card. Convert automatically when the trial ends."
        docsHref="/docs/features/subscriptions/trials"
      />

      <FeaturePageGraphic graphic={VectorField} />

      <FeaturePageIntro>
        Capture the card up front. Defer the charge. Convert automatically
        when the trial ends.
      </FeaturePageIntro>

      <FeatureSection title="Pay-up-front, without the friction">
        <p>
          The customer enters a <strong>trialing</strong> subscription with
          full access to every benefit on the product.
        </p>
        <p>
          The card is captured at checkout. The charge is deferred until
          the trial ends.
        </p>
        <p>
          When it converts, Polar charges the saved card and the cycle
          starts. Cancel mid-trial and no money moves.
        </p>
        <p>
          If conversion fails, the subscription enters the same recovery
          flow as any past-due renewal. A temporary card issue doesn&apos;t
          cost you the customer.
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
              'Polar emails customers before the trial ends so the charge is never a surprise.',
          },
          {
            icon: <ShieldOutlined fontSize="large" />,
            title: 'Abuse protection',
            description:
              'Detect repeat trial sign-ups by email or payment fingerprint and block them.',
          },
          {
            icon: <EditCalendarOutlined fontSize="large" />,
            title: 'Adjust on the fly',
            description:
              'Extend, shorten, or end any trial from the dashboard or the API. Status flips automatically.',
          },
        ]}
      />

      <FeatureSplit
        title="Configure a trial in three places"
        description="Set a default at the product level for predictable behavior, then override it per campaign or per customer when you need to. Whichever value is closest to the customer wins."
        bullets={[
          {
            title: 'On the product',
            description:
              'A baseline trial that applies to every checkout for that product. Set the unit (day, week, month, year) and the duration. Edit the product, edit the trial.',
          },
          {
            title: 'On a Checkout Link',
            description:
              'Override the product trial for a specific link. Useful for partner deals, longer trials in cold-traffic ads, or shorter trials in retargeting.',
          },
          {
            title: 'On a Checkout Session',
            description:
              'Set the trial programmatically when you create a session via the API. Hand customers a trial length tuned to their plan, region, or referral source.',
          },
        ]}
      />

      <FeatureRichList
        title="Reminders timed to the trial"
        description="Polar emails the customer before the trial ends so the conversion charge feels expected. The reminder timing is calibrated to the trial length so it lands when it&apos;s actually useful."
        items={[
          {
            title: 'Trials of 3 days or more',
            description:
              'A reminder goes out 3 days before the trial ends. Long enough for the customer to act on the email but short enough to still feel relevant.',
          },
          {
            title: 'Trials of 1 to 3 days',
            description:
              'A reminder is sent 1 day before the trial ends. Useful for short evaluation windows where 3 days would land before the customer even started.',
          },
          {
            title: 'Trials shorter than 1 day',
            description:
              'No reminder is sent. The trial is so short the customer is already in the product. Skipping the email keeps the inbox clean.',
          },
          {
            title: 'Optional, per organization',
            description:
              'If you prefer to handle conversion communication yourself, turn reminders off under Settings → Billing → Customer notifications.',
          },
        ]}
      />

      <FeatureSection title="Stop abuse without breaking the funnel">
        <p>
          Toggle <strong>Prevent trial abuse</strong> and Polar tracks
          redemptions across your products.
        </p>
        <p>
          Repeat sign-ups are blocked when they match a normalized email
          (so <strong>user+alias@example.com</strong> reads as{' '}
          <strong>user@example.com</strong>) or share a payment-method
          fingerprint with a previous trial.
        </p>
        <p>
          The checkout doesn&apos;t dead-end. Polar refreshes the session
          without the trial, and the customer can complete a paid checkout.
        </p>
        <p>
          Fewer free-tier farmers. Zero lost paying conversions.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Turn evaluators into customers."
        description="Add a trial to any subscription product and let Polar handle the timing."
      />
    </FeaturePageLayout>
  )
}
