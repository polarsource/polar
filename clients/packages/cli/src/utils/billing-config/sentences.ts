import { isDeepStrictEqual } from 'node:util'
import type { AppliedEntry } from '@/schemas/BillingConfig'
import {
  ALL_EVENTS,
  Rendered,
  aggregation,
  count,
  filter,
  isSet,
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

export const meterCycle = (interval: unknown, count: unknown) =>
  isSet(interval) ? recurrence(interval, count) : 'with billing'

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
  const billing = shared === undefined ? billed : `${billed}, ${shared}`
  return [
    isSet(product['meter_interval'])
      ? `${billing}, metered ${meterCycle(product['meter_interval'], product['meter_interval_count'])}`
      : billing,
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

const meteredPrices = (product: Record<string, unknown>) => [
  ...prices(product, 'metered_unit'),
  ...prices(product, 'metered_tiers'),
]

type Side = 'before' | 'after'

const diffMeters = (change: AppliedEntry['diff'][number], side: Side) => {
  const value = change[side]
  if (change.field === 'prices') {
    return meteredPrices({ prices: value }).map((price) => name(price['meter']))
  }
  const meter =
    change.field === 'properties' ? record(value)?.['meter'] : undefined
  return meter === undefined ? [] : [name(meter)]
}

export const usedMeters = ({ action, diff }: AppliedEntry, side: Side) =>
  action === 'updated'
    ? [...new Set(diff.flatMap((change) => diffMeters(change, side)))]
    : []

export const productMeters = (
  input: unknown,
  unitOf: (meter: string) => string,
): MeterUse[] => {
  const product = record(input)
  if (product === undefined) return []
  const byMeter = new Map<string, Record<string, unknown>[]>()
  for (const price of meteredPrices(product)) {
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
  if (benefit['type'] === 'slack_shared_channel' && properties !== undefined) {
    return fields([
      ['type', 'Slack channel'],
      ['channel', name(properties['channel_name_template'])],
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

// A changed meter re-sends the prices and properties that use it as they were
const changed = ({ before, after }: AppliedEntry['diff'][number]) =>
  !isDeepStrictEqual(before, after)

const FIELD_PROPERTIES: Record<string, string> = {
  form_label: 'label',
  form_help_text: 'help',
  form_placeholder: 'placeholder',
  min_length: 'min length',
  max_length: 'max length',
  ge: 'min',
  le: 'max',
}

const propertyValue = (property: string, value: unknown, type: unknown) => {
  if (value === undefined || value === null) return value
  if (property === 'options' && Array.isArray(value)) {
    return new Rendered(
      value
        .map(record)
        .map(
          (option) => `${name(option?.['value'])} → ${name(option?.['label'])}`,
        )
        .join('\n'),
    )
  }
  if (type === 'date' && typeof value === 'number') {
    return new Rendered(new Date(value * 1000).toISOString().slice(0, 10))
  }
  if (typeof value === 'boolean') return new Rendered(value ? 'yes' : 'no')
  return value
}

const propertyText = (property: string, value: unknown, type: unknown) => {
  const shown = propertyValue(property, value, type)
  return shown instanceof Rendered
    ? shown.text.replaceAll('\n', ', ')
    : name(shown)
}

export const customFieldSentence = (input: unknown) => {
  const field = record(input)
  if (field === undefined) return undefined
  return fields([
    ['type', name(field['type'])],
    ['name', name(field['name'])],
    ...Object.entries(record(field['properties']) ?? {})
      .filter(([, value]) => isSet(value))
      .map(
        ([key, value]) =>
          [
            FIELD_PROPERTIES[key] ?? key,
            propertyText(key, value, field['type']),
          ] as const,
      ),
  ])
}

// A custom field's properties show as one row each, with readable names.
const customFieldProperties = (
  change: AppliedEntry['diff'][number],
  type: unknown,
): AppliedEntry['diff'] => {
  const before = record(change.before) ?? {}
  const after = record(change.after) ?? {}
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !isDeepStrictEqual(before[key], after[key]))
    .map((key) => ({
      field: FIELD_PROPERTIES[key] ?? key,
      before: propertyValue(key, before[key], type),
      after: propertyValue(key, after[key], type),
    }))
}

export const shownDiff = (
  section: string,
  raw: AppliedEntry['diff'],
  document: unknown,
): AppliedEntry['diff'] => {
  const diff = raw.filter(changed)
  if (section === 'custom_fields') {
    return diff.flatMap((change) =>
      change.field === 'properties'
        ? customFieldProperties(change, record(document)?.['type'])
        : [change],
    )
  }
  return diff
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
