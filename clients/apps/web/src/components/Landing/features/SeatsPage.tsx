"use client";

import GroupAddOutlined from "@mui/icons-material/GroupAddOutlined";
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
} from "./FeaturePageLayout";

export const SeatsPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="Pricing that scales with the team"
        description="A billing manager pays for a number of seats and assigns them to teammates. Add, remove, and prorate automatically, for subscriptions or perpetual licenses."
        docsHref="/docs/features/seat-based-pricing"
      />

      <FeaturePageGraphic graphic={LinkedRings} />

      <FeaturePageIntro>
        Pick a flat rate, charge graduated tiers, or unlock volume discounts as the team grows.
        Customers invite teammates by email, claim links handle onboarding, and changes to seat
        count prorate automatically. No email ping-pong, no spreadsheet of who has what.
      </FeaturePageIntro>

      <FeatureCardGrid
        title="Seat management, end to end"
        description="Everything billing managers need to invite, revoke, and reassign access, without writing your own permissions layer."
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
        ]}
      />

      <FeatureCTA
        title="Sell to teams without the plumbing."
        description="Ship seat-based products without writing your own assignment, claim, and proration logic."
      />
    </FeaturePageLayout>
  );
};
