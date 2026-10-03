import { schemas } from '@polar-sh/client'

type MigrationRecord = schemas['MerchantMigrationRecordItem']

export const MAPPING_KINDS = [
  'customers',
  'products',
  'prices',
  'discounts',
  'subscriptions',
] as const

export type MappingKind = (typeof MAPPING_KINDS)[number]

export type MappingState =
  | 'moved'
  | 'in_polar'
  | 'ready'
  | 'left_on_stripe'
  | 'failed'
  | 'not_imported'

export interface MappingRow {
  kind: MappingKind
  stripeId: string
  polarId: string | null
  label: string
  detail: string | null
  state: MappingState
  // The switch creates the Polar subscription, so this is when its batch ran.
  switchedAt: string | null
}

export type IdMapping = Record<MappingKind, MappingRow[]>

export interface PolarObjects {
  subscriptions: {
    id: string
    created_at: string
    customer_id: string
    product_id: string
    metadata: Record<string, unknown>
  }[]
  customers: { id: string; email?: string | null }[]
  products: {
    id: string
    name: string
    recurring_interval: string | null
    prices: { id: string; price_amount?: number; price_currency?: string }[]
  }[]
  discounts: { id: string; metadata: Record<string, unknown> }[]
}

// Subscriptions only exist in Polar once the switch moves them, so their
// switch outcome comes before their import status.
function recordState(record: MigrationRecord): MappingState {
  if (record.entity !== 'subscriptions') {
    return record.import_status === 'imported' ? 'in_polar' : 'not_imported'
  }
  if (record.cutover_status === 'moved') return 'moved'
  if (record.cutover_status === 'skipped') return 'left_on_stripe'
  if (record.cutover_status === 'failed') return 'failed'
  return record.dependencies_imported || record.import_status === 'imported'
    ? 'ready'
    : 'not_imported'
}

// Joins migration records to the Polar objects they became, through the
// back-links the import leaves: `provider_subscription_id` on subscriptions,
// `stripe_coupon_id` on discounts, the email on customers, and for products
// the switched subscriptions (a Stripe product splits per interval) or the
// name and interval.
export function buildIdMapping(
  records: Record<MappingKind, MigrationRecord[]>,
  polar: PolarObjects,
): IdMapping {
  const byMetadata = <T extends { metadata: Record<string, unknown> }>(
    objects: T[],
    key: string,
  ) => new Map(objects.map((object) => [String(object.metadata[key]), object]))
  const subscriptions = byMetadata(
    polar.subscriptions,
    'provider_subscription_id',
  )
  const discounts = byMetadata(polar.discounts, 'stripe_coupon_id')
  const customers = new Map(
    polar.customers.map((customer) => [
      customer.email?.toLowerCase(),
      customer.id,
    ]),
  )
  const products = new Map(
    polar.products.map((product) => [product.id, product]),
  )
  const productIds = new Map(
    polar.products.map((p) => [`${p.name}:${p.recurring_interval}`, p.id]),
  )
  for (const record of records.subscriptions) {
    const subscription = subscriptions.get(record.source_id)
    if (subscription && record.product_source_id) {
      productIds.set(
        `${record.product_source_id}:${record.recurring_interval}`,
        subscription.product_id,
      )
    }
  }

  const productFor = (record: MigrationRecord) =>
    productIds.get(
      `${record.product_source_id}:${record.recurring_interval}`,
    ) ??
    productIds.get(`${record.product_name}:${record.recurring_interval}`) ??
    null
  const priceFor = (record: MigrationRecord) =>
    products
      .get(productFor(record) ?? '')
      ?.prices.find(
        (price) =>
          price.price_amount === record.amount &&
          price.price_currency?.toLowerCase() ===
            record.currency?.toLowerCase(),
      )?.id ?? null

  const resolve: Record<
    MappingKind,
    (record: MigrationRecord) => string | null
  > = {
    customers: (record) =>
      customers.get((record.customer_email ?? record.title).toLowerCase()) ??
      null,
    products: productFor,
    prices: priceFor,
    discounts: (record) => discounts.get(record.source_id)?.id ?? null,
    subscriptions: (record) => subscriptions.get(record.source_id)?.id ?? null,
  }

  return Object.fromEntries(
    MAPPING_KINDS.map((kind) => [
      kind,
      records[kind].map((record): MappingRow => {
        const polarId = resolve[kind](record)
        // Prices live inside a product record and carry no import status.
        const state =
          kind === 'prices'
            ? polarId
              ? 'in_polar'
              : 'not_imported'
            : recordState(record)
        return {
          kind,
          stripeId: record.source_id,
          polarId: state === 'not_imported' ? null : polarId,
          label: record.title,
          detail: record.subtitle ?? null,
          state,
          switchedAt:
            state === 'moved'
              ? (subscriptions.get(record.source_id)?.created_at ?? null)
              : null,
        }
      }),
    ]),
  ) as IdMapping
}
