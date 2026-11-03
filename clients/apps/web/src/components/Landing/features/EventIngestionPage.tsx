'use client'

import { RadialSpinner } from '../graphics/RadialSpinner'
import {
  FeatureCardGrid,
  FeatureCTA,
  FeatureHighlight,
  FeaturePageHeader,
  FeaturePageIntro,
  FeaturePageLayout,
  FeatureRichList,
  FeatureSection,
  FeatureSplit,
} from './FeaturePageLayout'

export const EventIngestionPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        graphic={RadialSpinner}
        title="Event ingestion for usage billing"
        description="Send an event when usage happens. Polar takes it from there."
        docsHref="/docs/features/usage-based-billing/event-ingestion"
      />

      <FeaturePageIntro>
        An event is a name, a customer and whatever metadata you want to bill
        on. Post it from your application and every meter can read it.
      </FeaturePageIntro>

      <FeatureSection title="What an event holds">
        <p>
          Every event starts with a <FeatureHighlight>name</FeatureHighlight>{' '}
          that says what happened, such as ai_usage, video_streamed or
          file_uploaded. Meters use it to pick the events they care about.
        </p>
        <p>
          It carries a <FeatureHighlight>customer</FeatureHighlight>, given as
          the Polar customer ID or the ID you already use for that user in your
          own database. No mapping table to keep in sync.
        </p>
        <p>
          The rest is <FeatureHighlight>metadata</FeatureHighlight>, a JSON
          object with anything worth filtering or summing later. Tokens in and
          out, the model, seconds of compute, bytes stored.
        </p>
        <p>
          That is the whole contract. You describe what happened once, and the
          pricing decisions stay on the Polar side where you can change them
          without touching your code.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            title: 'One call',
            description:
              'Post a batch of events through the SDK or the Events Ingestion API.',
          },
          {
            title: 'Your customer IDs',
            description:
              'Attribute usage with the external ID your application already has.',
          },
          {
            title: 'Immutable records',
            description:
              'Once an event is ingested it cannot be changed or deleted.',
          },
          {
            title: 'Backdated events',
            description:
              'Set a timestamp in the past for batched ingestion or replays from your queue.',
          },
        ]}
      />

      <FeatureRichList
        title="Ingestion strategies"
        description="The ingestion SDK wraps the most common event sources, so the events fire without you writing the plumbing."
        items={[
          {
            title: 'LLM strategy',
            description:
              'Wrap a model from the AI SDK. Prompt and completion tokens are reported for every model call.',
          },
          {
            title: 'Stream strategy',
            description:
              'Wrap any readable or writable stream and the bytes it consumes are reported as they flow.',
          },
          {
            title: 'S3 strategy',
            description:
              'Wrap the AWS S3 client and every byte uploaded is reported for you.',
          },
          {
            title: 'Delta-time strategy',
            description:
              'Measure how long any piece of execution takes and report the duration.',
          },
          {
            title: 'Manual ingestion',
            description:
              'When no strategy fits, post events directly through the SDK or the API.',
          },
        ]}
      />

      <FeatureSplit
        title="Built to be billed on"
        description="Ingestion follows a few fixed rules, so the number on the invoice is always one you can explain."
        bullets={[
          {
            title: 'Events are never edited',
            description:
              'The record of what a customer used is append-only, so a past invoice can always be traced back to its events.',
          },
          {
            title: 'Late events land on the current cycle',
            description:
              'Events are billed in the period Polar receives them. Closed invoices are never reopened.',
          },
          {
            title: 'Timestamps still count',
            description:
              'The timestamp you supply places the event on the usage charts and sets the date range on the invoice line.',
          },
          {
            title: 'Usage is never blocked',
            description:
              'Polar always accepts the event. Whether to enforce a limit is a decision for your product.',
          },
        ]}
      />

      <FeatureCTA
        title="Send your first event"
        description="Install the SDK and ingest an event in a few lines."
      />
    </FeaturePageLayout>
  )
}
