"use client";

import LocalOfferOutlined from "@mui/icons-material/LocalOfferOutlined";
import PercentOutlined from "@mui/icons-material/PercentOutlined";
import TimerOutlined from "@mui/icons-material/TimerOutlined";
import { WaveBars } from "../graphics/WaveBars";
import {
  FeatureCardGrid,
  FeatureCTA,
  FeaturePageGraphic,
  FeaturePageHeader,
  FeaturePageIntro,
  FeaturePageLayout,
} from "./FeaturePageLayout";

export const DiscountsPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="Promo codes that pay off"
        description="Run launches, win-back campaigns, and partner deals with discounts that apply automatically through codes, checkout links, or the API."
        docsHref="/docs/features/discounts"
      />

      <FeaturePageGraphic graphic={WaveBars} />

      <FeaturePageIntro>
        Pick the shape that fits the campaign. Discount a one-time purchase, take a chunk off the
        first month, or apply a percentage forever. Auto-apply through Checkout Links, prefill via
        query parameter, or attach programmatically when you create a Checkout Session.
      </FeaturePageIntro>

      <FeatureCardGrid
        title="Every restriction you'll need"
        description="Limit who can redeem, when, and how often, without building your own coupon engine."
        cards={[
          {
            icon: <LocalOfferOutlined fontSize="large" />,
            title: "Restrict by product",
            description: "Scope discounts to a subset of products, including ones created later.",
          },
          {
            icon: <TimerOutlined fontSize="large" />,
            title: "Time windows",
            description: "Set start and end dates so a discount goes live and expires on its own.",
          },
          {
            icon: <PercentOutlined fontSize="large" />,
            title: "Redemption limits",
            description: "Cap total redemptions to keep promotions and partner deals controlled.",
          },
        ]}
      />

      <FeatureCTA
        title="Run smarter promotions."
        description="Spin up discount codes for any campaign, without writing your own coupon engine."
      />
    </FeaturePageLayout>
  );
};
