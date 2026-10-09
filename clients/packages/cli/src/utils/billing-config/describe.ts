import * as ui from '@/utils/ui'

const name = (input: unknown) =>
  ui.printable(String(input)).replace(/\s+/g, ' ').trim()

const OPERATORS: Record<string, string> = {
  eq: '=',
  ne: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: '~',
  not_like: '!~',
}

const record = (input: unknown): Record<string, unknown> | undefined =>
  typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : undefined

const clause = (input: Record<string, unknown>) =>
  `${name(input['property'])} ${OPERATORS[String(input['operator'])] ?? name(input['operator'])} ${JSON.stringify(input['value'])}`

const filter = (input: Record<string, unknown>, nested = false): string => {
  const clauses = (input['clauses'] as unknown[]).map((item) => {
    const value = record(item)
    return value && 'conjunction' in value
      ? filter(value, true)
      : value
        ? clause(value)
        : JSON.stringify(item)
  })
  if (clauses.length === 0) return 'all events'
  if (clauses.length === 1) return clauses[0] ?? ''
  const conjunction = String(input['conjunction']).toUpperCase()
  return nested
    ? `(${clauses.join(` ${conjunction} `)})`
    : clauses.join(`\n${conjunction} `)
}

const aggregation = (input: Record<string, unknown>) =>
  input['property'] === undefined
    ? name(input['func'])
    : `${name(input['func'])}(${name(input['property'])})`

const minorUnits = (code: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
  }).resolvedOptions().maximumFractionDigits ?? 2

const MAX_FRACTION_DIGITS = 20

const scaleOf = (minor: unknown) => {
  const plain = /^-?\d+(?:\.(\d+))?$/.exec(String(minor))
  const fraction =
    plain === null
      ? (Number(minor).toFixed(MAX_FRACTION_DIGITS).split('.')[1] ?? '')
      : (plain[1] ?? '')
  return fraction.replace(/0+$/, '').length
}

const money = (minor: unknown, currency: unknown) => {
  const code = String(currency).toUpperCase()
  const units = Number(minor)
  if (!Number.isFinite(units) || !/^[A-Z]{3}$/.test(code)) {
    return `${name(minor)} ${name(currency)}`
  }
  const digits = minorUnits(code)
  const amount = units / 10 ** digits
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    currencyDisplay: 'code',
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.min(
      MAX_FRACTION_DIGITS,
      Math.max(digits, scaleOf(minor) + digits),
    ),
  })
    .format(amount)
    .replace(/\u00a0/g, ' ')
}

export class Rendered {
  readonly text: string
  constructor(text: string) {
    this.text = text
  }
}

export interface PriceGroup {
  readonly label: string
  readonly text: Rendered
}

const groupLabel = (input: Record<string, unknown>) => {
  switch (input['amount_type']) {
    case 'fixed':
      return 'fixed'
    case 'metered_unit':
      return `per ${name(input['meter'])}`
    default:
      return undefined
  }
}

const groupText = (items: ReadonlyArray<Record<string, unknown>>) => {
  const amounts = items.map((item) =>
    money(
      item['amount_type'] === 'fixed'
        ? item['price_amount']
        : item['unit_amount'],
      item['price_currency'],
    ),
  )
  const caps = items.flatMap((item) =>
    item['cap_amount'] === undefined || item['cap_amount'] === null
      ? []
      : [money(item['cap_amount'], item['price_currency'])],
  )
  return caps.length === 0
    ? amounts.join(', ')
    : `${amounts.join(', ')}\ncapped at ${caps.join(', ')}`
}

export const priceGroups = (input: unknown): PriceGroup[] | undefined => {
  if (!Array.isArray(input) || input.length === 0) return undefined
  const groups = new Map<string, Record<string, unknown>[]>()
  for (const item of input) {
    const value = record(item)
    const label = value === undefined ? undefined : groupLabel(value)
    if (value === undefined || label === undefined) return undefined
    groups.set(label, [...(groups.get(label) ?? []), value])
  }
  return [...groups].map(([label, items]) => ({
    label,
    text: new Rendered(groupText(items)),
  }))
}

const prices = (items: unknown[]) =>
  priceGroups(items)
    ?.map(({ label, text }) => `${label}: ${text.text.replaceAll('\n', ', ')}`)
    .join('\n')

const credit = (input: Record<string, unknown>) =>
  `${name(input['units'])} units of ${name(input['meter'])}${input['rollover'] === true ? ', rolling over' : ''}`

const scalars = (items: unknown[]) =>
  items.every((item) => typeof item === 'string' || typeof item === 'number')
    ? items.map((item) => name(item)).join(', ')
    : undefined

export const describeValue = (input: unknown): string | undefined => {
  if (input instanceof Rendered) return input.text
  if (Array.isArray(input)) {
    return input.length === 0 ? 'none' : (prices(input) ?? scalars(input))
  }
  const value = record(input)
  if (!value) return undefined
  if ('conjunction' in value && Array.isArray(value['clauses'])) {
    return filter(value)
  }
  if ('func' in value) return aggregation(value)
  if ('amount_type' in value) {
    return prices([value])
  }
  if ('units' in value && 'meter' in value) return credit(value)
  return undefined
}
