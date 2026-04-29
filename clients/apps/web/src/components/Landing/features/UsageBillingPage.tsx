'use client'

import ElectricMeterOutlined from '@mui/icons-material/ElectricMeterOutlined'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import KeyboardDoubleArrowRightOutlined from '@mui/icons-material/KeyboardDoubleArrowRightOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import { Dumbbell } from '../graphics/Dumbbell'
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

export const UsageBillingPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="Usage-based billing on events"
        description="Ingest events. Aggregate them into meters. Bill on the result."
        docsHref="/docs/features/usage-based-billing/introduction"
      />

      <FeaturePageGraphic graphic={Dumbbell} />

      <FeaturePageIntro>
        Send events from your application. Polar aggregates them into meters and
        writes line items on the next invoice.
      </FeaturePageIntro>

      <FeatureSection title="Events, meters, prices">
        <p>
          The model is built on three primitives that compose. It starts with{' '}
          <strong>events</strong>, immutable records of something that happened
          in your product, posted with a customer ID and any metadata you want
          to keep.
        </p>
        <p>
          On top of those events sit <strong>meters</strong>, which filter and
          aggregate the stream into a number per customer. Pick how the number
          is calculated (count, sum, average, min, max, or unique) and the rest
          is bookkeeping.
        </p>
        <p>
          A meter only matters once it&apos;s priced, which is what{' '}
          <strong>metered prices</strong> are for. Attach one to a product and
          Polar reads the meter at the end of each cycle, then adds the
          corresponding line item to the next invoice.
        </p>
        <p>
          The whole pipeline reuses the rest of the system. Renewals, proration,
          tax, and discounts behave the same way they do for fixed-price
          products, so usage billing slots in next to whatever you&apos;re
          already selling.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            icon: <KeyboardDoubleArrowRightOutlined fontSize="large" />,
            title: 'Event ingestion',
            description:
              'Post events from your application or use SDK strategies for LLMs, streams, and S3.',
          },
          {
            icon: <ElectricMeterOutlined fontSize="large" />,
            title: 'Customer meters',
            description:
              'Per-customer meters that update in real time as events arrive.',
          },
          {
            icon: <ReceiptLongOutlined fontSize="large" />,
            title: 'Metered prices',
            description:
              'Attach a meter to a product. Polar bills the consumed amount on the next invoice.',
          },
          {
            icon: <InsightsOutlined fontSize="large" />,
            title: 'Customer state',
            description:
              'A single API call returns every active meter and current balance.',
          },
        ]}
      />

      <FeatureSplit
        title="Six aggregation functions"
        description="The same event stream can power multiple meters. Change pricing without re-instrumenting your application."
        bullets={[
          {
            title: 'Count',
            description:
              'Total number of events that match the filter. For API calls or per-action billing.',
          },
          {
            title: 'Sum',
            description:
              'Add a metadata property, like total tokens, bytes processed, or seconds of compute.',
          },
          {
            title: 'Min, max, average',
            description:
              'Derived metrics like peak concurrency or average response size.',
          },
          {
            title: 'Unique',
            description:
              'Count distinct values of a property. Charge per unique user, project, or document.',
          },
        ]}
      />

      <FeatureRichList
        title="Ingestion strategies"
        description="The Polar SDK ships helpers for the most common event sources. Wrap a model client, an S3 bucket, or any HTTP body and the events flow."
        items={[
          {
            title: 'LLM strategy',
            description:
              'Wrap an OpenAI-compatible model. Polar counts prompt and completion tokens automatically. Works with the Vercel AI SDK and any model that returns a usage block.',
          },
          {
            title: 'Stream strategy',
            description:
              'Tap a streaming response and count chunks, bytes, or duration. For transcription, generation, or any long-lived call.',
          },
          {
            title: 'S3 strategy',
            description:
              'Meter file uploads and downloads through your S3-compatible storage. Bill on bytes transferred or objects created.',
          },
          {
            title: 'Delta-time strategy',
            description:
              'Measure wall-clock time spent inside a function or session. Bill per second of usage.',
          },
          {
            title: 'Manual ingestion',
            description:
              "When the strategies don't fit, post events directly through the SDK.",
          },
        ]}
      />

      <FeatureSection title="Customer meters">
        <p>
          Every metered customer carries a live <strong>customer meter</strong>{' '}
          that updates as events arrive, readable from the API or shown directly
          in the Customer Portal. Your dashboards and your customers&apos;
          in-app views can read from the same source without you keeping a
          parallel ledger.
        </p>
        <p>
          One thing Polar deliberately does not do is block usage when a
          customer crosses a quota. That decision belongs in your product, where
          you know the context. The meter exposes the signal, and you choose
          what to do with it: enforce a hard limit, prompt for an upgrade, or
          let the overage flow through to the next invoice.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Start metering events"
        description="Set up a meter and ingest your first event with the SDK."
      />
    </FeaturePageLayout>
  )
}
