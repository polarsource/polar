'use client'

import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import PaidOutlined from '@mui/icons-material/PaidOutlined'
import RouteOutlined from '@mui/icons-material/RouteOutlined'
import StackedLineChartOutlined from '@mui/icons-material/StackedLineChartOutlined'
import { GaugeSweep } from '../graphics/GaugeSweep'
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

export const CostInsightsPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="See what each customer costs to serve"
        description="Annotate events with cost. Get profit and LTV per customer."
        docsHref="/docs/features/cost-insights/introduction"
      />

      <FeaturePageGraphic graphic={GaugeSweep} />

      <FeaturePageIntro>
        Polar already tracks revenue from orders and subscriptions. Cost
        Insights adds the spending side, so profit and lifetime value can be
        computed against actual cost of service rather than a guess.
      </FeaturePageIntro>

      <FeatureSection title="How it works">
        <p>
          The mechanism is intentionally small. When you ingest an event through
          the Polar API, you can attach a <strong>_cost</strong> property with
          an amount and a currency, and Polar will treat that as the cost of
          serving the event.
        </p>
        <p>
          Those costs are aggregated alongside revenue on the same pipeline that
          already powers your usage meters, so there&apos;s no second source of
          truth to maintain and no separate ETL job to run.
        </p>
        <p>
          The result is queryable through the Metrics API and visible in the
          dashboard with no additional setup. Profit and lifetime value land per
          customer, ready to plot or feed into your own analytics.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            icon: <PaidOutlined fontSize="large" />,
            title: 'Cost events',
            description:
              'Annotate any ingested event with a _cost amount and currency.',
          },
          {
            icon: <RouteOutlined fontSize="large" />,
            title: 'Cost traces',
            description:
              'Drill into individual events to see which calls drove cost.',
          },
          {
            icon: <StackedLineChartOutlined fontSize="large" />,
            title: 'Profit metrics',
            description:
              'Revenue minus cost, computed automatically and available through the Metrics API.',
          },
          {
            icon: <InsightsOutlined fontSize="large" />,
            title: 'Customer LTV',
            description:
              'Per-customer lifetime value, computed against the actual cost to serve.',
          },
        ]}
      />

      <FeatureSplit
        title="What teams meter as cost"
        description="Anything you pay for that can be attributed to a customer can be tracked as cost."
        bullets={[
          {
            title: 'LLM and AI APIs',
            description:
              'Token cost per call to OpenAI, Anthropic, or any provider you route through.',
          },
          {
            title: 'Infrastructure',
            description:
              'Compute, storage, bandwidth, and database load attributed to a customer.',
          },
          {
            title: 'Third-party services',
            description:
              "Email, SMS, voice, search, and other vendor APIs you call on the customer's behalf.",
          },
          {
            title: 'Internal services',
            description:
              'Allocate the cost of an internal microservice, queue, or pipeline step.',
          },
        ]}
      />

      <FeatureRichList
        title="What lands in metrics"
        description="The same Metrics API and dashboard you use for revenue, with cost as a first-class dimension."
        items={[
          {
            title: 'Cost per customer',
            description:
              'Sum of all cost events for a customer over any window.',
          },
          {
            title: 'Profit per customer',
            description:
              'Revenue minus cost, calculated the same way every time.',
          },
          {
            title: 'Lifetime value',
            description:
              'Cumulative profit since a customer signed up, ready to plot or pipe into a dashboard.',
          },
        ]}
      />

      <FeatureSection title="One pipeline, two sides">
        <p>
          Cost Insights doesn&apos;t introduce a parallel system. The events you
          already ingest for usage billing get one extra property, and the rest
          of the work happens on the same backend.
        </p>
        <p>
          That means a single source of truth across revenue, usage, and cost,
          and metrics that line up because they&apos;re computed from the same
          stream.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Track cost on existing events"
        description="Add a _cost property to your ingestion calls."
      />
    </FeaturePageLayout>
  )
}
