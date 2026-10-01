import { MappingKind, MappingRow, MappingState } from './idMapping'

export const KIND_LABELS: Record<MappingKind, string> = {
  customers: 'Customers',
  products: 'Products',
  prices: 'Prices',
  discounts: 'Discounts',
  subscriptions: 'Subscriptions',
}

export const STATE_LABELS: Record<MappingState, string> = {
  moved: 'Billing on Polar',
  in_polar: 'In Polar',
  not_switched: 'Not switched',
  left_on_stripe: 'Left on Stripe',
  failed: 'Failed',
  not_imported: 'Not imported',
}

export const STATE_TONES: Record<
  MappingState,
  'success' | 'warning' | 'danger' | 'muted'
> = {
  moved: 'success',
  in_polar: 'success',
  not_switched: 'muted',
  left_on_stripe: 'warning',
  failed: 'danger',
  not_imported: 'muted',
}

export function polarResourceHref(
  organizationSlug: string,
  row: MappingRow,
): string | null {
  if (!row.polarId) return null
  const base = `/dashboard/${organizationSlug}`
  switch (row.kind) {
    case 'customers':
      return `${base}/customers/${row.polarId}`
    case 'products':
      return `${base}/products/${row.polarId}`
    case 'subscriptions':
      return `${base}/sales/subscriptions/${row.polarId}`
    case 'discounts':
      return `${base}/products/discounts`
    case 'prices':
      return null
  }
}

export const COMPLETE_TITLE = 'Your subscriptions are billed by Polar'

export const COMPLETE_INTRO =
  'Polar now charges the subscriptions below on their next renewal. Use the ID map to point your own database, webhooks and links at Polar.'

export interface NextStep {
  key: string
  title: string
  description: string
  href?: (organizationSlug: string) => string
  linkLabel?: string
}

export const NEXT_STEPS: NextStep[] = [
  {
    key: 'ids',
    title: 'Swap Stripe IDs for Polar IDs in your database',
    description:
      'Download the ID map and backfill every place you store cus_, sub_, prod_ or price_ IDs.',
  },
  {
    key: 'webhooks',
    title: 'Listen to Polar webhooks',
    description:
      'Grant and revoke access from subscription.* and order.* events instead of Stripe’s.',
    href: (slug) => `/dashboard/${slug}/settings/webhooks`,
    linkLabel: 'Webhooks',
  },
  {
    key: 'stripe-webhooks',
    title: 'Turn off Stripe billing webhooks and emails',
    description:
      'Stripe still sends events for subscriptions left there. Disable the ones that would revoke access for switched customers, plus Stripe’s billing emails.',
  },
  {
    key: 'checkout',
    title: 'Send new customers to Polar Checkout',
    description:
      'Replace Stripe Checkout and Payment Links with Polar checkout links for the imported products.',
    href: (slug) => `/dashboard/${slug}/products/checkout-links`,
    linkLabel: 'Checkout links',
  },
  {
    key: 'keep-stripe',
    title: 'Keep Stripe open for what stayed there',
    description:
      'Subscriptions left on Stripe keep billing there until they end or you switch them.',
  },
]
