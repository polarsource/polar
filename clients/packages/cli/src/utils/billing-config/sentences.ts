import {
  ALL_EVENTS,
  aggregation,
  count,
  filter,
  money,
  name,
  record,
  scaled,
  unitScale,
} from '@/utils/billing-config/describe'
import * as ui from '@/utils/ui'
import { redactUrl } from '@/utils/url'

const fields = (pairs: ReadonlyArray<readonly [string, string]>) => {
  const width = Math.max(...pairs.map(([label]) => label.length))
  return pairs.map(
    ([label, value]) => `${ui.dim(label.padEnd(width))}  ${value}`,
  )
}

export const recurrence = (interval: unknown, count: unknown) => {
  if (interval === undefined || interval === null) return 'once'
  const times = typeof count === 'number' ? count : 1
  return times === 1
    ? `per ${name(interval)}`
    : `per ${times} ${name(interval)}s`
}

const CURRENCIES = ' / '

const prices = (product: Record<string, unknown>, kind: string) =>
  (Array.isArray(product['prices']) ? product['prices'] : [])
    .map(record)
    .filter(
      (price): price is Record<string, unknown> =>
        price !== undefined && price['amount_type'] === kind,
    )

const pricing = (product: Record<string, unknown>) => {
  const cycle = recurrence(
    product['recurring_interval'],
    product['recurring_interval_count'],
  )
  const fixed = prices(product, 'fixed')
    .map((price) => money(price['price_amount'], price['price_currency']))
    .join(CURRENCIES)
  return fixed === '' ? `billed ${cycle}` : `${fixed} ${cycle}`
}

export interface MeterUse {
  readonly id: string
  readonly facts: ReadonlyArray<string>
}

export const productMeters = (
  input: unknown,
  unitOf: (meter: string) => string,
): MeterUse[] => {
  const product = record(input)
  if (product === undefined) return []
  const byMeter = new Map<string, Record<string, unknown>[]>()
  for (const price of prices(product, 'metered_unit')) {
    const id = name(price['meter'])
    byMeter.set(id, [...(byMeter.get(id) ?? []), price])
  }
  return [...byMeter].map(([id, items]) => {
    const scale = unitScale(items.map((item) => item['unit_amount']))
    const rate = items
      .map((item) =>
        money(scaled(item['unit_amount'], scale), item['price_currency']),
      )
      .join(CURRENCIES)
    const caps = items.flatMap((item) =>
      item['cap_amount'] === undefined || item['cap_amount'] === null
        ? []
        : [money(item['cap_amount'], item['price_currency'])],
    )
    return {
      id,
      facts: [
        `${rate} per ${scale === 1 ? '' : `${count(scale)} `}${unitOf(id)}`,
        ...(caps.length === 0 ? [] : [`capped at ${caps.join(CURRENCIES)}`]),
      ],
    }
  })
}

export const meterUnit = (input: unknown) => {
  const meter = record(input)
  return meter?.['unit'] === 'custom'
    ? name(meter['custom_label'])
    : meter?.['unit'] === 'token'
      ? 'tokens'
      : 'units'
}

export const productSentence = (input: unknown) => {
  const product = record(input)
  if (product === undefined) return undefined
  return [
    pricing(product),
    ...(typeof product['visibility'] === 'string' &&
    product['visibility'] !== 'public'
      ? [name(product['visibility'])]
      : []),
  ]
}

export const benefitSentence = (input: unknown) => {
  const benefit = record(input)
  if (benefit === undefined) return undefined
  const properties = record(benefit['properties'])
  const visibility =
    typeof benefit['visibility'] === 'string' &&
    benefit['visibility'] !== 'public'
      ? [['visibility', name(benefit['visibility'])] as const]
      : []
  if (benefit['type'] === 'meter_credit' && properties !== undefined) {
    return fields([
      ['meter', name(properties['meter'])],
      ['credits', count(properties['units'])],
      ...(properties['rollover'] === true
        ? [['rollover', 'yes'] as const]
        : []),
      ...visibility,
    ])
  }
  return fields([
    [
      'type',
      benefit['type'] === 'feature_flag'
        ? 'feature flag'
        : name(benefit['type']),
    ],
    ...visibility,
  ])
}

// Slack and Discord carry their credential in the path, so only the host is shown.
export const webhookUrl = (url: unknown, format: unknown) => {
  const shown = redactUrl(name(url))
  if (format === 'raw') return shown
  const parsed = URL.parse(shown)
  return parsed ? `${parsed.origin}/***` : shown
}

export const webhookSentence = (input: unknown) => {
  const webhook = record(input)
  if (webhook === undefined) return undefined
  const events = Array.isArray(webhook['events']) ? webhook['events'] : []
  return fields([
    ['url', webhookUrl(webhook['url'], webhook['format'])],
    ...(webhook['format'] !== 'raw'
      ? [['format', name(webhook['format'])] as const]
      : []),
    ['events', events.map((event) => name(event)).join(', ')],
  ])
}

export const meterSentence = (input: unknown) => {
  const meter = record(input)
  if (meter === undefined) return undefined
  const criteria = record(meter['filter'])
  const func = record(meter['aggregation'])
  const events =
    criteria === undefined || !Array.isArray(criteria['clauses'])
      ? ALL_EVENTS
      : filter(criteria).replaceAll('\n', ' ')
  return fields([
    ['events', events],
    ['aggregation', func === undefined ? 'count' : aggregation(func)],
    ...(meter['unit'] === 'custom'
      ? [['unit', name(meter['custom_label'])] as const]
      : meter['unit'] === 'token'
        ? [['unit', 'tokens'] as const]
        : []),
  ])
}

export const discountValue = (discount: Record<string, unknown>) => {
  const amounts = record(discount['amounts'])
  if (discount['type'] === 'fixed' && amounts !== undefined) {
    const off = Object.entries(amounts)
      .map(([currency, amount]) => money(amount, currency))
      .join(CURRENCIES)
    return `${off} off`
  }
  const points = Number(discount['basis_points'])
  return Number.isFinite(points)
    ? `${points / 100}% off`
    : name(discount['basis_points'])
}

export const discountDuration = (discount: Record<string, unknown>) => {
  const months = discount['duration_in_months']
  if (discount['duration'] !== 'repeating') return name(discount['duration'])
  return months === 1 ? '1 month' : `${count(months)} months`
}

const optional = (label: string, value: unknown) =>
  value === undefined || value === null ? [] : [[label, name(value)] as const]

export const discountSentence = (input: unknown) => {
  const discount = record(input)
  if (discount === undefined) return undefined
  const products = Array.isArray(discount['products'])
    ? discount['products'].map((id) => name(id))
    : []
  return fields([
    ['value', discountValue(discount)],
    ['duration', discountDuration(discount)],
    ...optional('code', discount['code']),
    ['products', products.length === 0 ? 'all' : products.join(', ')],
    ...optional('redemptions', discount['max_redemptions']),
    ...optional('per customer', discount['max_redemptions_per_customer']),
    ...optional('starts', discount['starts_at']),
    ...optional('ends', discount['ends_at']),
  ])
}
