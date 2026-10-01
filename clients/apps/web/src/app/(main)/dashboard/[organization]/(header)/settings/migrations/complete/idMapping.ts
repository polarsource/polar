import { schemas } from '@polar-sh/client'

type MigrationRecord = schemas['MerchantMigrationRecordItem']

export type MappingKind =
  | 'customers'
  | 'products'
  | 'prices'
  | 'discounts'
  | 'subscriptions'

export const MAPPING_KINDS: MappingKind[] = [
  'customers',
  'products',
  'prices',
  'discounts',
  'subscriptions',
]

export type MappingState =
  | 'moved'
  | 'in_polar'
  | 'not_switched'
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
  note: string | null
}

export interface PolarSubscriptionRef {
  id: string
  customer: { id: string }
  product: {
    id: string
    recurring_interval: string | null
    recurring_interval_count: number | null
  }
  metadata: Record<string, unknown>
}

export interface PolarProductRef {
  id: string
  name: string
  recurring_interval: string | null
  recurring_interval_count: number | null
  prices: {
    id: string
    amount_type: string
    price_amount?: number
    price_currency?: string
  }[]
}

export interface PolarCustomerRef {
  id: string
  email?: string | null
}

export interface PolarDiscountRef {
  id: string
  metadata: Record<string, unknown>
}

export interface MappingSources {
  records: Record<MappingKind, MigrationRecord[]>
  subscriptions: PolarSubscriptionRef[]
  customers: PolarCustomerRef[]
  products: PolarProductRef[]
  discounts: PolarDiscountRef[]
}

// A Stripe product becomes one Polar product per billing interval, so the
// Stripe product ID alone doesn't pick a Polar product.
const productKey = (
  stripeProductId: string,
  interval: string | null | undefined,
  count: number | null | undefined,
) => `${stripeProductId}:${interval ?? ''}:${count ?? 1}`

// Subscriptions are only created in Polar when the switch moves them, so the
// switch outcome decides their state before the import status does.
const recordState = (record: MigrationRecord): MappingState => {
  if (record.entity === 'subscriptions') {
    switch (record.cutover_status) {
      case 'moved':
        return 'moved'
      case 'skipped':
        return 'left_on_stripe'
      case 'failed':
        return 'failed'
    }
    return record.import_status === 'imported' ? 'not_switched' : 'not_imported'
  }
  return record.import_status === 'imported' ? 'in_polar' : 'not_imported'
}

const recordNote = (record: MigrationRecord): string | null =>
  record.cutover_error ?? (record.status === 'skipped' ? record.reason : null)

export function buildIdMapping({
  records,
  subscriptions,
  customers,
  products,
  discounts,
}: MappingSources): Record<MappingKind, MappingRow[]> {
  const subscriptionByStripeId = new Map<string, PolarSubscriptionRef>()
  for (const subscription of subscriptions) {
    const stripeId = subscription.metadata.provider_subscription_id
    if (typeof stripeId === 'string') {
      subscriptionByStripeId.set(stripeId, subscription)
    }
  }

  const customerByStripeId = new Map<string, string>()
  // Email is unique per organization, and reaches customers whose
  // subscription stayed on Stripe and so has no Polar subscription to join on.
  const customerByEmail = new Map(
    customers.flatMap((customer) =>
      customer.email ? [[customer.email.toLowerCase(), customer.id]] : [],
    ),
  )
  const productByKey = new Map<string, string>()
  for (const record of records.subscriptions) {
    const polar = subscriptionByStripeId.get(record.source_id)
    if (!polar) continue
    if (record.customer_source_id) {
      customerByStripeId.set(record.customer_source_id, polar.customer.id)
    }
    if (record.product_source_id) {
      productByKey.set(
        productKey(
          record.product_source_id,
          polar.product.recurring_interval,
          polar.product.recurring_interval_count,
        ),
        polar.product.id,
      )
    }
  }

  const productsByNameInterval = new Map<string, PolarProductRef[]>()
  for (const product of products) {
    const key = productKey(
      product.name.toLowerCase(),
      product.recurring_interval,
      product.recurring_interval_count,
    )
    productsByNameInterval.set(key, [
      ...(productsByNameInterval.get(key) ?? []),
      product,
    ])
  }
  const productById = new Map(products.map((product) => [product.id, product]))

  const polarProductFor = (record: MigrationRecord): string | null => {
    const stripeProductId = record.product_source_id ?? record.source_id
    const interval = record.recurring_interval
    const count = record.recurring_interval_count
    const viaSubscription = productByKey.get(
      productKey(stripeProductId, interval, count),
    )
    if (viaSubscription) return viaSubscription
    const byName = productsByNameInterval.get(
      productKey(
        (record.product_name ?? record.title).toLowerCase(),
        interval,
        count,
      ),
    )
    return byName?.length === 1 ? byName[0].id : null
  }

  const polarPriceFor = (record: MigrationRecord): string | null => {
    const product = productById.get(polarProductFor(record) ?? '')
    if (!product || record.amount == null || !record.currency) return null
    const currency = record.currency.toLowerCase()
    const price = product.prices.find(
      (candidate) =>
        candidate.amount_type === 'fixed' &&
        candidate.price_amount === record.amount &&
        candidate.price_currency?.toLowerCase() === currency,
    )
    return price?.id ?? null
  }

  const discountByCoupon = new Map<string, string>()
  for (const discount of discounts) {
    const couponId = discount.metadata.stripe_coupon_id
    if (typeof couponId === 'string') {
      discountByCoupon.set(couponId, discount.id)
    }
  }

  const resolvers: Record<
    Exclude<MappingKind, 'prices'>,
    (record: MigrationRecord) => string | null
  > = {
    customers: (record) =>
      customerByStripeId.get(record.source_id) ??
      customerByEmail.get(
        (record.customer_email ?? record.title).toLowerCase(),
      ) ??
      null,
    products: polarProductFor,
    discounts: (record) => discountByCoupon.get(record.source_id) ?? null,
    subscriptions: (record) =>
      subscriptionByStripeId.get(record.source_id)?.id ?? null,
  }

  const resolve = (
    kind: MappingKind,
    record: MigrationRecord,
  ): Pick<MappingRow, 'state' | 'polarId'> => {
    // Prices live inside a product record and carry no import status, so
    // finding the Polar price is what says it moved.
    if (kind === 'prices') {
      const polarId = polarPriceFor(record)
      return { state: polarId ? 'in_polar' : 'not_imported', polarId }
    }
    const state = recordState(record)
    return {
      state,
      polarId: state === 'not_imported' ? null : resolvers[kind](record),
    }
  }

  const result = {} as Record<MappingKind, MappingRow[]>
  for (const kind of MAPPING_KINDS) {
    result[kind] = records[kind].map((record) => ({
      kind,
      stripeId: record.source_id,
      label: record.title,
      detail: record.subtitle ?? null,
      note: recordNote(record),
      ...resolve(kind, record),
    }))
  }
  return result
}
