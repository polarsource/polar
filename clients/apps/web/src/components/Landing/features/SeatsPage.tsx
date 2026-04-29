"use client";

import GroupAddOutlined from "@mui/icons-material/GroupAddOutlined";
import HubOutlined from "@mui/icons-material/HubOutlined";
import MailOutlineOutlined from "@mui/icons-material/MailOutlineOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import { LinkedRings } from "../graphics/LinkedRings";
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
} from "./FeaturePageLayout";

export const SeatsPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="Pricing that scales with the team"
        description="One billing manager. Many seats. Prorated automatically."
        docsHref="/docs/features/seat-based-pricing"
      />

      <FeaturePageGraphic graphic={LinkedRings} />

      <FeaturePageIntro>
        One billing manager. Many seats. Customers invite teammates by email, and proration is
        handled for you.
      </FeaturePageIntro>

      <FeatureSection title="One product, many seats">
        <p>
          A <strong>billing manager</strong> buys a product with a seat count. They assign seats to
          teammates by email or external customer ID.
        </p>
        <p>
          Benefits only fire when a seat is claimed. The billing manager doesn&apos;t get benefits
          by default, so a finance buyer pays without taking up a seat.
        </p>
        <p>
          Works for <strong>recurring subscriptions</strong> and <strong>perpetual licenses</strong>
          . Subscriptions stay in sync with the team. Licenses grant benefits forever once claimed.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            icon: <MailOutlineOutlined fontSize="large" />,
            title: "Invite by email",
            description:
              "Assign seats by email or external customer ID. Claim links handle the rest.",
          },
          {
            icon: <TuneOutlined fontSize="large" />,
            title: "Prorated changes",
            description:
              "Adding seats charges immediately, prorated. Reducing seats issues a credit.",
          },
          {
            icon: <GroupAddOutlined fontSize="large" />,
            title: "Self-serve portal",
            description: "Customers manage seats from the Customer Portal. No email ping-pong.",
          },
          {
            icon: <HubOutlined fontSize="large" />,
            title: "API and webhooks",
            description:
              "Assign seats programmatically and react to seat.claimed and seat.revoked events in real time.",
          },
        ]}
      />

      <FeatureSplit
        title="Three pricing models, one product"
        description="Pick the shape that fits the way you sell to teams. You can change the model on a draft product before it ships, then run with it."
        bullets={[
          {
            title: "Fixed price per seat",
            description:
              "Every seat costs the same amount. Predictable for both sides and the simplest option to launch with.",
          },
          {
            title: "Graduated tiers",
            description:
              "Each tier range is billed at its own rate. Seats inside tier 1 get the tier 1 price; seats in tier 2 get the tier 2 price. Total bill is the sum of every range.",
          },
          {
            title: "Volume discounts",
            description:
              "A single rate is chosen by total seat count and applied to every seat. Crossing a threshold lowers the price for the whole subscription, not just the new seats.",
          },
        ]}
      />

      <FeatureRichList
        title="A clear model for who has access"
        description="Polar separates the act of paying for seats from the act of using them. Three explicit statuses keep your product simple to reason about."
        items={[
          {
            title: "Pending",
            description:
              "A seat has been assigned and an invitation email has been sent, but the recipient hasn’t claimed it yet. The billing manager can resend the invitation if the link expires.",
          },
          {
            title: "Claimed",
            description:
              "The teammate accepted the invitation. Benefits are granted automatically and the seat counts toward the team’s usage of the product.",
          },
          {
            title: "Revoked",
            description:
              "The billing manager pulled access from a specific teammate. Benefits drop, but the subscription keeps paying for the seat slot until the seat count is reduced.",
          },
          {
            title: "Reduce vs revoke",
            description:
              "Revoking a seat frees the slot for reassignment. Reducing the seat count is what actually lowers the bill, and Polar issues a prorated credit for the unused remainder of the cycle.",
          },
        ]}
      />

      <FeatureSection title="First-class in the API">
        <p>
          Seat assignments are real objects. List them, assign them, revoke them programmatically.
        </p>
        <p>
          Listen for <strong>seat.claimed</strong>, <strong>seat.revoked</strong>, and{" "}
          <strong>subscription.updated</strong> webhooks. Your permission system stays in lockstep.
        </p>
        <p>
          Up to 1,000 seats per subscription. Arbitrary metadata on every seat for role, team, or
          external user ID.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Sell to teams without the plumbing."
        description="Ship seat-based products without writing your own assignment, claim, and proration logic."
      />
    </FeaturePageLayout>
  );
};
