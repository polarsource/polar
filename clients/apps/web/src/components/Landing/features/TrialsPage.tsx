"use client";

import HourglassTopOutlined from "@mui/icons-material/HourglassTopOutlined";
import NotificationsActiveOutlined from "@mui/icons-material/NotificationsActiveOutlined";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import { VectorField } from "../graphics/VectorField";
import {
  FeatureCardGrid,
  FeatureCTA,
  FeaturePageGraphic,
  FeaturePageHeader,
  FeaturePageIntro,
  FeaturePageLayout,
} from "./FeaturePageLayout";

export const TrialsPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="Free trials that convert themselves"
        description="Collect payment up front, give customers room to evaluate, and convert automatically when the trial ends. Reminders, extensions, and abuse protection are built in."
        docsHref="/docs/features/subscriptions/trials"
      />

      <FeaturePageGraphic graphic={VectorField} />

      <FeaturePageIntro>
        Configure a trial on the product, the checkout link, or per session. The customer subscribes
        today, gets full access, and is charged automatically when the period ends. Polar emails
        them a few days before conversion so it&apos;s never a surprise. Abuse protection blocks
        repeat sign-ups by email or payment fingerprint.
      </FeaturePageIntro>

      <FeatureCardGrid
        title="Trials, end to end"
        description="Everything you need so a trial converts cleanly, without surprise charges or repeat-offender freeloaders."
        cards={[
          {
            icon: <HourglassTopOutlined fontSize="large" />,
            title: "Automatic conversion",
            description:
              "When the trial ends, the subscription charges and continues. No manual step.",
          },
          {
            icon: <NotificationsActiveOutlined fontSize="large" />,
            title: "Conversion reminders",
            description:
              "Polar emails customers before the trial ends so the charge is never a surprise.",
          },
          {
            icon: <ShieldOutlined fontSize="large" />,
            title: "Abuse protection",
            description:
              "Detect repeat trial sign-ups by email or payment fingerprint and block them.",
          },
        ]}
      />

      <FeatureCTA
        title="Turn evaluators into customers."
        description="Add a trial to any subscription product and let Polar handle the timing."
      />
    </FeaturePageLayout>
  );
};
