import type { FeatureData } from './featureData'
import { TextRings } from '../TextRings'
import { GaugeSweep } from '../GaugeSweep'
import { VolumetricSlices } from '../VolumetricSlices'
import { OrbitingSpheres } from '../OrbitingSpheres'

export const infrastructureFeatures: FeatureData[] = [
  {
    slug: 'event-ingestion',
    category: 'Infrastructure',
    categoryNumber: '04',
    title: 'Event Ingestion',
    docsUrl: 'https://docs.polar.sh/features/usage-based-billing/event-ingestion',
    subtitle: 'Capture application usage events via SDK or HTTP.',
    description:
      'Ingest usage data from your application to power usage-based billing. Events are immutable once recorded. Use Polar SDKs for simple integration with name, customer ID, and custom metadata properties.',
    details: [
      { label: 'SDK Integration', text: 'TypeScript SDK for simple event ingestion with metadata' },
      { label: 'Event Structure', text: 'Name, customer ID, and custom metadata properties' },
      { label: 'Immutable Events', text: 'Events cannot be modified after ingestion' },
      { label: 'HTTP Fallback', text: 'Direct HTTP API for any language or platform' },
    ],
    Graphic: TextRings,
  },
  {
    slug: 'metering',
    category: 'Infrastructure',
    categoryNumber: '04',
    title: 'Metering',
    docsUrl: 'https://docs.polar.sh/features/usage-based-billing/meters',
    subtitle: 'Define usage metrics with filters and aggregation.',
    description:
      'Meters filter ingested events and apply aggregation functions to compute customer usage. Combine clauses with property operators to create flexible, queryable usage definitions that power billing.',
    details: [
      { label: 'Event Filters', text: 'Combine clauses to filter events by property' },
      { label: 'Aggregation', text: 'Functions to compute usage from filtered events' },
      { label: 'Metadata Querying', text: 'Filter on event metadata without prefix syntax' },
      { label: 'Customer Meters', text: 'Per-customer meter quantities via API' },
    ],
    Graphic: GaugeSweep,
  },
  {
    slug: 'invoicing',
    category: 'Infrastructure',
    categoryNumber: '04',
    title: 'Invoicing',
    docsUrl: 'https://docs.polar.sh/features/usage-based-billing/billing',
    subtitle: 'Automated invoicing for subscriptions and usage charges.',
    description:
      'Invoicing is handled automatically for subscription products with metered prices. View all sales with detailed metadata including amounts, tax, and customer history. Generate and retrieve invoices via API.',
    details: [
      { label: 'Auto-Generation', text: 'Invoices generated automatically per billing cycle' },
      { label: 'Usage Charges', text: 'Metered usage rolled into subscription invoices' },
      { label: 'Tax Breakdown', text: 'Itemized tax amounts on every invoice' },
      { label: 'API Access', text: 'Generate and retrieve invoices programmatically' },
    ],
    Graphic: VolumetricSlices,
  },
  {
    slug: 'wallets',
    category: 'Infrastructure',
    categoryNumber: '04',
    title: 'Wallets',
    docsUrl: 'https://docs.polar.sh/features/usage-based-billing/credits',
    subtitle: 'Prepaid balances and draw-down accounts for your API.',
    description:
      'Customer wallets for prepaid balances that draw down with usage. Combined with credits and meters, wallets give customers predictable costs while you maintain real-time balance tracking and enforcement.',
    details: [
      { label: 'Prepaid Balance', text: 'Customers fund wallets and draw down over time' },
      { label: 'Real-Time Tracking', text: 'Live balance queries via API or customer portal' },
      { label: 'Usage Integration', text: 'Automatic deduction from meters and credits' },
      { label: 'Top-Up Flows', text: 'Self-service or API-driven balance replenishment' },
    ],
    Graphic: OrbitingSpheres,
  },
]
