import type { FeatureData } from './featureData'
import { Dumbbell } from '../Dumbbell'
import { CycleArrow } from '../CycleArrow'
import { LinkedRings } from '../LinkedRings'
import { CreditArc } from '../CreditArc'

export const billingFeatures: FeatureData[] = [
  {
    slug: 'usage-billing',
    category: 'Billing',
    categoryNumber: '01',
    title: 'Usage Billing',
    docsUrl: 'https://docs.polar.sh/features/usage-based-billing/introduction',
    subtitle: 'Charge customers based on consumption with metered pricing.',
    description:
      'Ingest application usage events, define meters to represent consumption, and add metered prices to subscription products. Unit pricing charges a fixed amount per unit of usage, with volume pricing tiers for scale.',
    details: [
      { label: 'Event Ingestion', text: 'Capture usage events via SDK or HTTP in real time' },
      { label: 'Meters & Filters', text: 'Define meters with event filters and aggregation functions' },
      { label: 'Unit Pricing', text: 'Charge fixed amounts per unit of metered consumption' },
      { label: 'Subscription Integration', text: 'Works out-of-the-box with subscription products' },
    ],
    Graphic: Dumbbell,
  },
  {
    slug: 'subscriptions',
    category: 'Billing',
    categoryNumber: '01',
    title: 'Subscriptions',
    docsUrl: 'https://docs.polar.sh/features/products',
    subtitle: 'Recurring billing with flexible cycles and automatic proration.',
    description:
      'Unified product model for subscriptions with billing cycles from daily to yearly. Supports trials, upgrades, downgrades, and proration — managed automatically so you never write billing logic.',
    details: [
      { label: 'Billing Cycles', text: 'Daily, weekly, monthly, yearly, or custom intervals' },
      { label: 'Trials', text: 'Free trial periods with built-in abuse prevention' },
      { label: 'Proration', text: 'Automatic proration on upgrades and downgrades' },
      { label: 'Multi-Subscription', text: 'Support multiple active subscriptions per customer' },
    ],
    Graphic: CycleArrow,
  },
  {
    slug: 'seats',
    category: 'Billing',
    categoryNumber: '01',
    title: 'Seats',
    docsUrl: 'https://docs.polar.sh/features/seat-based-pricing',
    subtitle: 'Sell team products with assignable seats and per-user access.',
    description:
      'Seat-based pricing lets billing managers purchase seats and assign them to team members. Each seat holder gets their own access to product benefits, with support for flat, graduated, and volume-discounted pricing.',
    details: [
      { label: 'Seat Assignment', text: 'Assign and manage seats via email or customer ID' },
      { label: 'Tiered Pricing', text: 'Flat, graduated, and volume-discounted seat models' },
      { label: 'Invitation Flow', text: 'Team members receive invite emails to claim their seat' },
      { label: 'Perpetual Licenses', text: 'One-time purchases with no expiry alongside subscriptions' },
    ],
    Graphic: LinkedRings,
  },
  {
    slug: 'credits',
    category: 'Billing',
    categoryNumber: '01',
    title: 'Credits',
    docsUrl: 'https://docs.polar.sh/features/usage-based-billing/credits',
    subtitle: 'Let customers prepay for usage with managed credit balances.',
    description:
      'Credits allow customers to pre-pay for usage on metered products instead of risking large bills at month-end. Credits are deducted first from meter usage, and any overage is charged separately.',
    details: [
      { label: 'Pre-Payment', text: 'Customers pre-pay usage units to control costs' },
      { label: 'Deduction Model', text: 'Credits deducted first, then charged for overage' },
      { label: 'Auto Distribution', text: 'Credits issued per cycle or as one-time benefits' },
      { label: 'Balance Tracking', text: 'Query customer meter balances via API' },
    ],
    Graphic: CreditArc,
  },
]
