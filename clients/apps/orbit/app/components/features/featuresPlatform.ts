import type { FeatureData } from './featureData'
import { RadialSpinner } from '../RadialSpinner'
import { ConcentricDraw } from '../ConcentricDraw'
import { VectorField } from '../VectorField'
import { ShapeGrid } from '../ShapeGrid'

export const platformFeatures: FeatureData[] = [
  {
    slug: 'analytics',
    category: 'Platform',
    categoryNumber: '03',
    title: 'Analytics',
    docsUrl: 'https://docs.polar.sh/features/analytics',
    subtitle: 'Professional metrics dashboard for revenue and sales.',
    description:
      'Built-in analytics dashboard with revenue, orders, average order value, MRR, and conversion rate metrics. Filter by time period, date range, and product with granular views from hourly to yearly.',
    details: [
      { label: 'Revenue Metrics', text: 'Total revenue, MRR, and AOV with flexible time periods' },
      { label: 'Product Filtering', text: 'Filter by individual products or subscription tiers' },
      { label: 'Granular Views', text: 'Hourly, daily, weekly, monthly, and yearly periods' },
      { label: 'Cost Insights', text: 'Track costs, profits, and customer lifetime value' },
    ],
    Graphic: RadialSpinner,
  },
  {
    slug: 'customer-portal',
    category: 'Platform',
    categoryNumber: '03',
    title: 'Customer Portal',
    docsUrl: 'https://docs.polar.sh/features/customer-portal',
    subtitle: 'Self-service hub for orders, subscriptions, and benefits.',
    description:
      'A destination where customers view and manage their orders, subscriptions, receipts, and claimed benefits. Redirect via URL or generate pre-authenticated portal links from your application.',
    details: [
      { label: 'Order Management', text: 'View all purchases and active subscriptions' },
      { label: 'Receipts & Benefits', text: 'Access receipts and view claimed product benefits' },
      { label: 'Email Auth', text: 'Customers sign in using their purchase email' },
      { label: 'Pre-Auth Links', text: 'Generate authenticated portal links via API' },
    ],
    Graphic: ConcentricDraw,
  },
  {
    slug: 'webhooks',
    category: 'Platform',
    categoryNumber: '03',
    title: 'Webhooks',
    docsUrl: 'https://docs.polar.sh/integrate/webhooks/endpoints',
    subtitle: 'Real-time event notifications with Standard Webhooks.',
    description:
      'Webhooks follow the Standard Webhooks specification with built-in signature validation. Support for raw JSON, Slack, and Discord delivery formats. Test safely in sandbox before going live.',
    details: [
      { label: 'Event Notifications', text: 'Purchases, subscriptions, cancellations, refunds' },
      { label: 'Signature Validation', text: 'Cryptographic validation using shared secret' },
      { label: 'Multiple Formats', text: 'Raw JSON, Slack, and Discord message formatting' },
      { label: 'Sandbox Testing', text: 'Safe testing of webhook events before production' },
    ],
    Graphic: VectorField,
  },
  {
    slug: 'api',
    category: 'Platform',
    categoryNumber: '03',
    title: 'API',
    docsUrl: 'https://docs.polar.sh/api-reference/introduction',
    subtitle: 'Complete REST API with typed SDKs for every language.',
    description:
      'Full REST API with production and sandbox environments. Organization Access Tokens for server operations, Customer Access Tokens for portal access. SDKs for TypeScript, Python, Go, and PHP.',
    details: [
      { label: 'Dual Environments', text: 'Separate URLs for live payments and safe testing' },
      { label: 'Token Auth', text: 'Organization and Customer Access Tokens' },
      { label: 'Typed SDKs', text: 'TypeScript, Python, Go, PHP with framework adapters' },
      { label: 'Customer Portal API', text: 'Separate endpoints for customer-facing operations' },
    ],
    Graphic: ShapeGrid,
  },
]
