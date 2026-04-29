"use client";

import AutorenewOutlined from "@mui/icons-material/AutorenewOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import { CycleArrow } from "../graphics/CycleArrow";
import {
  FeatureCardGrid,
  FeatureCTA,
  FeaturePageGraphic,
  FeaturePageHeader,
  FeaturePageIntro,
  FeaturePageLayout,
} from "./FeaturePageLayout";

export const SubscriptionsPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="Recurring revenue, on autopilot"
        description="Renewals, proration, dunning, cancellations, and benefits, all handled. Customers self-serve from the portal; you stay focused on the product."
        docsHref="/docs/features/subscriptions/introduction"
      />

      <FeaturePageGraphic graphic={CycleArrow} />

      <FeaturePageIntro>
        At the end of each billing period Polar advances the cycle, generates an order, and charges
        the default payment method. If a charge fails, the subscription moves to past due and
        automated dunning kicks in. Renewal reminders, plan changes, and proration are all built
        into the same primitive.
      </FeaturePageIntro>

      <FeatureCardGrid
        title="Built for subscription businesses"
        description="Everything subscriptions need, without a billing engineer on staff."
        cards={[
          {
            icon: <CreditCardOutlined fontSize="large" />,
            title: "Flexible billing",
            description: "Fixed, pay-what-you-want, or free recurring prices on any cadence.",
          },
          {
            icon: <TrendingUpOutlined fontSize="large" />,
            title: "Plan changes",
            description: "Upgrades and downgrades with prorated charges and credits, instantly.",
          },
          {
            icon: <AutorenewOutlined fontSize="large" />,
            title: "Failed payment recovery",
            description: "Smart retry logic and grace periods keep more customers paying.",
          },
        ]}
      />

      <FeatureCTA
        title="Launch subscriptions today."
        description="Connect a product, set a recurring price, and start billing in minutes."
      />
    </FeaturePageLayout>
  );
};
