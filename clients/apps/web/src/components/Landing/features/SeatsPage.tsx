'use client'

import GroupAddOutlined from '@mui/icons-material/GroupAddOutlined'
import HubOutlined from '@mui/icons-material/HubOutlined'
import MailOutlineOutlined from '@mui/icons-material/MailOutlineOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import { LinkedRings } from '../graphics/LinkedRings'
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

export const SeatsPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="Per-seat pricing for team products"
        description="One billing manager, many seats. Prorated automatically."
        docsHref="/docs/features/seat-based-pricing"
      />

      <FeaturePageGraphic graphic={LinkedRings} />

      <FeaturePageIntro>
        Sell a product where one customer pays for a team. Invitations, claims,
        and proration are handled by Polar so you don&apos;t have to build seat
        management yourself.
      </FeaturePageIntro>

      <FeatureSection title="One product, many seats">
        <p>
          A seat-based product is purchased by a single{' '}
          <strong>billing manager</strong> who decides how many seats they need.
          From there, they assign seats to teammates by email or by your own
          external customer ID.
        </p>
        <p>
          Benefits only fire when a seat is actually claimed by the recipient,
          which keeps usage in step with billing. The billing manager
          doesn&apos;t receive benefits unless they assign a seat to themselves,
          so a finance buyer can pay without consuming a seat they&apos;ll never
          use.
        </p>
        <p>
          The same primitive covers <strong>recurring subscriptions</strong> and{' '}
          <strong>perpetual licenses</strong>. Subscriptions stay in sync with
          the team while the plan is active; licenses grant benefits forever
          once a seat is claimed, and growth happens through new orders rather
          than mutating the original purchase.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            icon: <MailOutlineOutlined fontSize="large" />,
            title: 'Invite by email',
            description:
              'Assign seats by email or external customer ID. Claim links handle onboarding.',
          },
          {
            icon: <TuneOutlined fontSize="large" />,
            title: 'Prorated changes',
            description:
              'Adding seats charges immediately, prorated. Reducing seats issues a credit.',
          },
          {
            icon: <GroupAddOutlined fontSize="large" />,
            title: 'Customer Portal',
            description:
              'Customers manage their own team without you in the loop.',
          },
          {
            icon: <HubOutlined fontSize="large" />,
            title: 'API and webhooks',
            description:
              'Assign seats programmatically and react to seat.claimed and seat.revoked events.',
          },
        ]}
      />

      <FeatureSplit
        title="Three pricing models"
        description="Pick the shape that matches the way you sell to teams. The choice is made when the product is created."
        bullets={[
          {
            title: 'Fixed price per seat',
            description:
              'Every seat costs the same amount. The simplest option, and the easiest to launch with.',
          },
          {
            title: 'Graduated tiers',
            description:
              'Each tier range is billed at its own rate. Seats in tier 1 use the tier 1 price; seats in tier 2 use the tier 2 price. The total is the sum of every range.',
          },
          {
            title: 'Volume discounts',
            description:
              'A single rate is chosen by total seat count and applied to every seat. Crossing a threshold lowers the price for the whole subscription, not just the new seats.',
          },
        ]}
      />

      <FeatureRichList
        title="Seat statuses"
        description="Polar separates the act of paying for a seat from the act of using one. Three statuses describe where any seat is in that process."
        items={[
          {
            title: 'Pending',
            description:
              'A seat has been assigned and an invitation has been sent. The recipient hasn’t claimed it yet, and the billing manager can resend if the link expires.',
          },
          {
            title: 'Claimed',
            description:
              'The teammate accepted the invitation. Benefits are granted automatically and the seat counts toward the team’s usage of the product.',
          },
          {
            title: 'Revoked',
            description:
              'The billing manager pulled access from a specific teammate. Benefits drop, but the subscription keeps paying for the slot until the seat count itself is reduced.',
          },
          {
            title: 'Reduce vs revoke',
            description:
              'Revoking frees a slot for reassignment. Reducing the seat count is what actually lowers the bill, and Polar issues a prorated credit for the unused remainder of the cycle.',
          },
        ]}
      />

      <FeatureSection title="API and webhooks">
        <p>
          Seat assignments are first-class objects in the API. List them on a
          subscription, assign them programmatically when a customer onboards a
          teammate inside your app, and revoke them through the same endpoint.
        </p>
        <p>
          On the receiving side, <strong>seat.claimed</strong>,{' '}
          <strong>seat.revoked</strong>, and{' '}
          <strong>subscription.updated</strong> webhooks let your own permission
          system stay in lockstep without polling.
        </p>
        <p>
          The model supports up to 1,000 seats per subscription and arbitrary
          metadata on every seat, so role, team, or external user ID can travel
          with the assignment. Seat-based pricing is in beta today; enable it
          under <strong>Settings → General → Features</strong>.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Sell to teams"
        description="Create a seat-based product and Polar handles assignment, claim, and proration."
      />
    </FeaturePageLayout>
  )
}
