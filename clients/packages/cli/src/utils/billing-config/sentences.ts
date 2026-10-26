import type { AppliedEntry } from '@/schemas/BillingConfig'
import {
  ALL_EVENTS,
  Rendered,
  aggregation,
  count,
  filter,
  money,
  name,
  record,
  scaled,
  taxOf,
  tierUnit,
  tiered,
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

const tierTable = (
  price: Record<string, unknown>,
  unit: string,
  tax: string | undefined,
) => {
  const lines = tiered(price)
  if (lines === undefined) return []
  const [kind, ...steps] = lines
  const currency = String(price['price_currency']).toUpperCase()
  return [
    [`${currency} per ${unit}`, kind, ...(tax === undefined ? [] : [tax])].join(
      ', ',
    ),
    ...steps.map((step) => `${ui.INDENT}${step}`),
  ]
}

const pricing = (product: Record<string, unknown>) => {
  const cycle = recurrence(
    product['recurring_interval'],
    product['recurring_interval_count'],
  )
  const fixed = prices(product, 'fixed')
  const tiers = [
    ...prices(product, 'seat_based'),
    ...prices(product, 'unit_based'),
  ]
  const taxes = [...fixed, ...tiers].map((price) => taxOf(price)[0])
  const uniform = new Set(taxes).size <= 1
  const own = (index: number) => (uniform ? undefined : taxes[index])
  const amounts = fixed
    .map((price, index) => {
      const amount = money(price['price_amount'], price['price_currency'])
      const tax = own(index)
      return tax === undefined ? amount : `${amount} (${tax})`
    })
    .join(CURRENCIES)
  const billed = amounts === '' ? `billed ${cycle}` : `${amounts} ${cycle}`
  const shared = uniform ? taxes[0] : undefined
  return [
    shared === undefined ? billed : `${billed}, ${shared}`,
    ...tiers.flatMap((price, index) =>
      tierTable(price, tierUnit(price) ?? 'unit', own(fixed.length + index)),
    ),
  ]
}

const taxFact = (items: ReadonlyArray<Record<string, unknown>>) => {
  const taxes = items.map((item) => taxOf(item)[0])
  if (new Set(taxes).size <= 1) return taxes[0] === undefined ? [] : [taxes[0]]
  return [
    items
      .flatMap((item, index) => {
        const tax = taxes[index]
        return tax === undefined
          ? []
          : [`${tax} (${String(item['price_currency']).toUpperCase()})`]
      })
      .join(', '),
  ]
}

export interface MeterUse {
  readonly id: string
  readonly facts: ReadonlyArray<string>
}

const unitFacts = (
  items: ReadonlyArray<Record<string, unknown>>,
  unit: string,
) => {
  if (items.length === 0) return []
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
  return [
    `${rate} per ${scale === 1 ? '' : `${count(scale)} `}${unit}`,
    ...(caps.length === 0 ? [] : [`capped at ${caps.join(CURRENCIES)}`]),
  ]
}

export const productMeters = (
  input: unknown,
  unitOf: (meter: string) => string,
): MeterUse[] => {
  const product = record(input)
  if (product === undefined) return []
  const byMeter = new Map<string, Record<string, unknown>[]>()
  for (const price of [
    ...prices(product, 'metered_unit'),
    ...prices(product, 'metered_tiers'),
  ]) {
    const id = name(price['meter'])
    byMeter.set(id, [...(byMeter.get(id) ?? []), price])
  }
  return [...byMeter].map(([id, items]) => {
    const units = items.filter((item) => item['amount_type'] === 'metered_unit')
    const tiers = items.filter(
      (item) => item['amount_type'] === 'metered_tiers',
    )
    return {
      id,
      facts: [
        ...unitFacts(units, unitOf(id)),
        ...tiers.flatMap((item) => tierTable(item, unitOf(id), undefined)),
        ...taxFact(items),
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
    ...pricing(product),
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

const shownUrl = (url: unknown, format: unknown) =>
  url === undefined || url === null
    ? url
    : new Rendered(webhookUrl(url, format))

// Webhook URLs in a diff are redacted by the format on their own side.
export const shownDiff = (
  section: string,
  diff: AppliedEntry['diff'],
  document: unknown,
): AppliedEntry['diff'] => {
  if (section !== 'webhooks') return diff
  const format = diff.find((change) => change.field === 'format')
  const before =
    format === undefined ? record(document)?.['format'] : format.before
  const after = record(document)?.['format']
  return diff.map((change) =>
    change.field === 'url'
      ? {
          ...change,
          before: shownUrl(change.before, before),
          after: shownUrl(change.after, after),
        }
      : change,
  )
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
