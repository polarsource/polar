import * as ui from '@/utils/ui'

export const name = (input: unknown) =>
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

export const record = (input: unknown): Record<string, unknown> | undefined =>
  typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : undefined

const clause = (input: Record<string, unknown>) =>
  `${name(input['property'])} ${OPERATORS[String(input['operator'])] ?? name(input['operator'])} ${JSON.stringify(input['value'])}`

export const ALL_EVENTS = 'all events'

export const filter = (
  input: Record<string, unknown>,
  nested = false,
): string => {
  const clauses = (input['clauses'] as unknown[]).map((item) => {
    const value = record(item)
    return value && 'conjunction' in value
      ? filter(value, true)
      : value
        ? clause(value)
        : JSON.stringify(item)
  })
  if (clauses.length === 0) return ALL_EVENTS
  if (clauses.length === 1) return clauses[0] ?? ''
  const conjunction = String(input['conjunction']).toUpperCase()
  return nested
    ? `(${clauses.join(` ${conjunction} `)})`
    : clauses.join(`\n${conjunction} `)
}

export const aggregation = (input: Record<string, unknown>) =>
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

export const money = (minor: unknown, currency: unknown) => {
  const code = String(currency).toUpperCase()
  const units = Number(minor)
  if (!Number.isFinite(units) || !/^[A-Z]{3}$/.test(code)) {
    return `${name(minor)} ${name(currency)}`
  }
  const digits = minorUnits(code)
  const amount = units / 10 ** digits
  const minimum = Number.isInteger(amount) ? 0 : digits
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: minimum,
    maximumFractionDigits: Math.max(
      minimum,
      Math.min(MAX_FRACTION_DIGITS, scaleOf(minor) + digits),
    ),
  })
    .format(amount)
    .replace(/ /g, ' ')
}

export const count = (input: unknown) =>
  typeof input === 'number' ? input.toLocaleString('en-US') : name(input)

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

const SCALES = [1, 1_000, 1_000_000]

const wholeMinor = (minor: unknown, scale: number) =>
  Number.isInteger(Number((Number(minor) * scale).toPrecision(15)))

export const unitScale = (minors: ReadonlyArray<unknown>) =>
  minors.some((minor) => Math.abs(Number(minor)) < 1)
    ? (SCALES.find((scale) =>
        minors.every((minor) => wholeMinor(minor, scale)),
      ) ?? 1)
    : 1

export const scaled = (minor: unknown, scale: number) =>
  scale === 1 ? minor : Number((Number(minor) * scale).toPrecision(15))

const price = (item: Record<string, unknown>): PriceGroup | undefined => {
  const currency = String(item['price_currency']).toUpperCase()
  if (item['amount_type'] === 'fixed') {
    return {
      label: currency,
      text: new Rendered(money(item['price_amount'], item['price_currency'])),
    }
  }
  if (item['amount_type'] !== 'metered_unit') return undefined
  const cap =
    item['cap_amount'] === undefined || item['cap_amount'] === null
      ? undefined
      : money(item['cap_amount'], item['price_currency'])
  const scale = unitScale([item['unit_amount']])
  const amount = money(
    scaled(item['unit_amount'], scale),
    item['price_currency'],
  )
  return {
    label: `${currency} per ${name(item['meter'])}`,
    text: new Rendered(
      `${amount}${scale === 1 ? '' : ` per ${count(scale)}`}${cap === undefined ? '' : `\ncapped at ${cap}`}`,
    ),
  }
}

export const priceGroups = (input: unknown): PriceGroup[] | undefined => {
  if (!Array.isArray(input) || input.length === 0) return undefined
  const groups = new Map<string, string[]>()
  for (const item of input) {
    const value = record(item)
    const group = value === undefined ? undefined : price(value)
    if (group === undefined) return undefined
    groups.set(group.label, [
      ...(groups.get(group.label) ?? []),
      group.text.text,
    ])
  }
  return [...groups].map(([label, texts]) => ({
    label,
    text: new Rendered(texts.join('\n')),
  }))
}

const prices = (items: unknown[]) =>
  priceGroups(items)
    ?.map(({ label, text }) => `${label}: ${text.text.replaceAll('\n', ', ')}`)
    .join('\n')

const credit = (input: Record<string, unknown>) =>
  `${count(input['units'])} ${name(input['meter'])} credits${input['rollover'] === true ? ', unused credits roll over' : ''}`

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
