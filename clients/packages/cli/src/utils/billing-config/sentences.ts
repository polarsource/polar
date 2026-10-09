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
  if (benefit['type'] === 'meter_credit' && properties !== undefined) {
    return fields([
      ['meter', name(properties['meter'])],
      ['credits', count(properties['units'])],
      ...(properties['rollover'] === true
        ? [['rollover', 'yes'] as const]
        : []),
    ])
  }
  return fields([
    [
      'type',
      benefit['type'] === 'feature_flag'
        ? 'feature flag'
        : name(benefit['type']),
    ],
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
