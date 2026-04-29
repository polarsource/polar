"use client";

import ElectricMeterOutlined from "@mui/icons-material/ElectricMeterOutlined";
import KeyboardDoubleArrowRightOutlined from "@mui/icons-material/KeyboardDoubleArrowRightOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import { Dumbbell } from "../graphics/Dumbbell";
import {
  FeatureCardGrid,
  FeatureCTA,
  FeaturePageGraphic,
  FeaturePageHeader,
  FeaturePageIntro,
  FeaturePageLayout,
} from "./FeaturePageLayout";

export const UsageBillingPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="Bill what your customers actually use"
        description="Ingest events from your application, aggregate them into meters, and charge with precision. Built for tokens, API calls, compute, and anything else you measure."
        docsHref="/docs/features/usage-based-billing/introduction"
      />

      <FeaturePageGraphic graphic={Dumbbell} />

      <FeaturePageIntro>
        Send raw events as they happen. Polar aggregates them into per-customer meters and rolls
        them up into the next invoice. No batch jobs, no reconciliation, no ledgers to maintain. The
        same primitive scales from your first thousand requests to your billionth.
      </FeaturePageIntro>

      <FeatureCardGrid
        title="Everything to ship usage billing"
        description="The primitives you need to integrate metered pricing without building your own ledger."
        cards={[
          {
            icon: <KeyboardDoubleArrowRightOutlined fontSize="large" />,
            title: "Event Ingestion",
            description:
              "Send events from your app or use SDK strategies for LLMs, streams, and more.",
          },
          {
            icon: <ElectricMeterOutlined fontSize="large" />,
            title: "Customer Meters",
            description: "Aggregate events into meters that track usage per customer in real time.",
          },
          {
            icon: <ReceiptLongOutlined fontSize="large" />,
            title: "Metered Pricing",
            description:
              "Attach metered prices to products and bill the difference at the end of each cycle.",
          },
        ]}
      />

      <FeatureCTA
        title="Ready to bill on usage?"
        description="Join companies that trust Polar for accurate, scalable usage-based billing."
      />
    </FeaturePageLayout>
  );
};
