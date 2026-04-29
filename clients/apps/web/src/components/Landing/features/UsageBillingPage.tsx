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
        title="Bill what your customers actually use"
        description="Ingest events. Meter them. Charge with precision."
        docsHref="/docs/features/usage-based-billing/introduction"
      />

      <FeaturePageGraphic graphic={Dumbbell} />

      <FeaturePageIntro>
        Send events as they happen. Polar rolls them up into the next invoice.
        No batch jobs. No ledgers to maintain.
      </FeaturePageIntro>

      <FeatureSection title="Three pieces, cleanly composed">
        <p>
          <strong>Events</strong> are immutable records of something that
          happened in your product. Post them with a customer ID and any
          metadata you need.
        </p>
        <p>
          <strong>Meters</strong> filter and aggregate those events. Count
          them. Sum a property. Take a max. Dedupe to count unique values.
        </p>
        <p>
          <strong>Metered prices</strong> attach a meter to a product. At the
          close of each cycle, Polar reads the balance and writes the line
          item.
        </p>
        <p>
          Renewals, proration, tax, and discounts run through the same
          pipeline as fixed-price products. Usage billing slots in without
          forking the codebase.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            icon: <KeyboardDoubleArrowRightOutlined fontSize="large" />,
            title: 'Event Ingestion',
            description:
              'Send events from your app or use SDK strategies for LLMs, streams, and more.',
          },
          {
            icon: <ElectricMeterOutlined fontSize="large" />,
            title: 'Customer Meters',
            description:
              'Aggregate events into meters that track usage per customer in real time.',
          },
          {
            icon: <ReceiptLongOutlined fontSize="large" />,
            title: 'Metered Pricing',
            description:
              'Attach metered prices to products and bill the difference at the end of each cycle.',
          },
          {
            icon: <InsightsOutlined fontSize="large" />,
            title: 'Customer State',
            description:
              'A single API call returns every active meter and balance, ready to render in your product.',
          },
        ]}
      />

      <FeatureSplit
        title="Aggregations for any pricing model"
        description="Pick the function that matches how you charge. The same event stream can power multiple meters, so you can experiment with pricing without re-instrumenting your product."
        bullets={[
          {
            title: 'Count',
            description:
              'Total number of events that match the filter. Ideal for API calls or per-action billing.',
          },
          {
            title: 'Sum',
            description:
              'Add up a metadata field, like total tokens, bytes processed, or seconds of compute.',
          },
          {
            title: 'Min, Max, Average',
            description:
              'Useful for derived metrics like peak concurrency or average response size.',
          },
          {
            title: 'Unique',
            description:
              'Count distinct values of a property. Charge per unique user, project, or document.',
          },
        ]}
      />

      <FeatureRichList
        title="Ingestion strategies, ready out of the box"
        description="Polar ships drop-in helpers for the integrations developers ask for most. Wrap a model client, an S3 bucket, or any HTTP body and the events flow without extra plumbing."
        items={[
          {
            title: 'LLM Strategy',
            description:
              'Wrap an OpenAI-compatible model with one line and Polar will count prompt and completion tokens automatically. Works with the Vercel AI SDK and any model that exposes a usage block.',
          },
          {
            title: 'Stream Strategy',
            description:
              'Tap a streaming response and count chunks, bytes, or duration as they pass through. Useful for transcription, generation, or any long-lived call.',
          },
          {
            title: 'S3 Strategy',
            description:
              'Meter file uploads or downloads through your S3-compatible storage and bill on bytes transferred or objects created.',
          },
          {
            title: 'Delta-Time Strategy',
            description:
              'Measure wall-clock time spent inside a function or session and charge per second of usage.',
          },
          {
            title: 'Manual ingestion',
            description:
              'When the strategies don’t fit, use the SDK to post events directly. Same shape, same guarantees, fully under your control.',
          },
        ]}
      />

      <FeatureSection title="Balances you can trust">
        <p>
          Every metered customer gets a live{' '}
          <strong>customer meter</strong>. Read it from the API or expose it
          in the portal.
        </p>
        <p>
          Balances update as events stream in. Your dashboards and your
          customers&apos; in-app views stay in sync, no second source of
          truth.
        </p>
        <p>
          Polar never blocks usage on its own. Overage is a signal, you
          decide what to do with it. Enforce a limit, prompt an upgrade, or
          let it flow to the next invoice.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Ready to bill on usage?"
        description="Join companies that trust Polar for accurate, scalable usage-based billing."
      />
    </FeaturePageLayout>
  )
}
