"use client";

import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import CardGiftcardOutlined from "@mui/icons-material/CardGiftcardOutlined";
import QueryStatsOutlined from "@mui/icons-material/QueryStatsOutlined";
import { CreditArc } from "../graphics/CreditArc";
import {
  FeatureCardGrid,
  FeatureCTA,
  FeaturePageGraphic,
  FeaturePageHeader,
  FeaturePageIntro,
  FeaturePageLayout,
} from "./FeaturePageLayout";

export const CreditsPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="A wallet for your API"
        description="Let customers prepay for usage and draw down over time. Credits deduct from meter balances first, and overage falls back to metered pricing if you allow it."
        docsHref="/docs/features/usage-based-billing/credits"
      />

      <FeaturePageGraphic graphic={CreditArc} />

      <FeaturePageIntro>
        Issue credits with a benefit attached to a product. Polar deducts usage from the balance
        first, then charges the metered price for any overage, or blocks overage entirely if you
        prefer. Refill on every cycle, or once on purchase. Per-meter balances stay isolated for
        clean accounting.
      </FeaturePageIntro>

      <FeatureCardGrid
        title="Built for prepaid billing"
        description="Sell credit packs, top-ups, and prepaid plans with primitives that work the way customers expect."
        cards={[
          {
            icon: <CardGiftcardOutlined fontSize="large" />,
            title: "Credits Benefit",
            description:
              "Attach credits to any product. Recurring grants on subscriptions, one-time on purchases.",
          },
          {
            icon: <AccountBalanceWalletOutlined fontSize="large" />,
            title: "Per-meter balances",
            description: "Each meter carries its own balance, so different units stay isolated.",
          },
          {
            icon: <QueryStatsOutlined fontSize="large" />,
            title: "Customer State API",
            description: "Read every active meter and remaining balance in a single call.",
          },
        ]}
      />

      <FeatureCTA
        title="Ship a prepaid plan."
        description="Sell credit packs and let usage draw them down. No custom ledger required."
      />
    </FeaturePageLayout>
  );
};
