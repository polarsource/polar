'use client'

import { SteppedRadial } from '../graphics/SteppedRadial'
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

export const MetersPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        graphic={SteppedRadial}
        title="Meters that turn events into usage"
        description="Filter the stream. Aggregate it. Price the result."
        docsHref="/docs/features/usage-based-billing/meters"
      />

      <FeaturePageIntro>
        A meter filters your events and aggregates them into one number per
        customer. That number is what gets billed.
      </FeaturePageIntro>

      <FeatureSection title="Filter, then aggregate">
        <p>
          A meter begins with a <FeatureHighlight>filter</FeatureHighlight>, a
          set of clauses that decide which events count. Match on the event name
          or on any metadata key, and combine clauses so that all of them, or
          any one of them, must match.
        </p>
        <p>
          The matching events then run through an{' '}
          <FeatureHighlight>aggregation</FeatureHighlight>. Count them, sum a
          property such as total tokens, or take the average, minimum, maximum
          or number of unique values.
        </p>
        <p>
          The result is a <FeatureHighlight>customer meter</FeatureHighlight>,
          one live figure for every customer that updates as events arrive.
          Attach a metered price and Polar bills it at the end of the cycle.
        </p>
        <p>
          Because meters read from the same event stream, a new pricing idea is
          a new meter. Your application keeps sending the events it already
          sends.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            title: 'Filter builder',
            description:
              'Equals, contains, greater than and more, on the event name or any metadata key.',
          },
          {
            title: 'Six aggregations',
            description:
              'Count, sum, average, minimum, maximum and unique over any property.',
          },
          {
            title: 'Live per customer',
            description:
              'Read the current value from the API or show it in the Customer Portal.',
          },
          {
            title: 'Preview before you save',
            description:
              'See the events a meter matches while you are still creating it.',
          },
        ]}
      />

      <FeatureSplit
        title="One stream, many meters"
        description="The aggregation decides what a unit of usage means. Pick the one that matches how you sell."
        bullets={[
          {
            title: 'Count',
            description:
              'The number of matching events. For API calls, agent runs or any per-action price.',
          },
          {
            title: 'Sum',
            description:
              'Add up a metadata property, like total tokens, bytes processed or seconds of compute.',
          },
          {
            title: 'Average, minimum, maximum',
            description:
              'Derived figures such as peak concurrency or average response size.',
          },
          {
            title: 'Unique',
            description:
              'Distinct values of a property. Charge per active user, project or document.',
          },
        ]}
      />

      <FeatureRichList
        title="Units your customers can read"
        description="A meter's unit controls how its price is shown on invoices, in checkout and in the Customer Portal. It never changes what is billed."
        items={[
          {
            title: 'Scalar',
            description:
              'A price per single unit, such as $0.05 / unit. For API calls and other plain counts.',
          },
          {
            title: 'Token',
            description:
              'A price per million, such as $20.00 / 1M tokens. For LLM token consumption.',
          },
          {
            title: 'Custom',
            description:
              'Your own label and multiplier, such as $0.023 / gigabyte or a price per thousand requests.',
          },
        ]}
      />

      <FeatureSection title="You decide what a limit means">
        <p>
          A customer meter is a signal, not a gate. Polar keeps counting when a
          customer passes a quota and leaves the response to your product, where
          the context is.
        </p>
        <p>
          Read the meter and enforce a hard limit, prompt for an upgrade, or let
          the overage flow through to the next invoice.
        </p>
      </FeatureSection>

      <FeatureCTA
        title="Create your first meter"
        description="Define a filter, pick an aggregation and attach a price."
      />
    </FeaturePageLayout>
  )
}
