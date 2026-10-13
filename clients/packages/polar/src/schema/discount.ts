import { Schema } from 'effect'
import { Currency } from './money'
import type { Digit, Money } from './money'

const Count = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(1),
  Schema.isLessThanOrEqualTo(2147483647),
)

// Mirrors `_code_validator` in server/polar/discount/schemas.py.
const Code = Schema.String.check(
  Schema.makeFilter((code) => {
    if (!/^[\p{L}\p{N}]+$/u.test(code)) {
      return 'Code must contain only alphanumeric characters.'
    }
    const length = [...code].length
    return length >= 3 && length <= 256
      ? undefined
      : 'Code must be between 3 and 256 characters long.'
  }),
)

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

const isCalendarDay = (value: string): boolean => {
  const day = value.slice(0, 10)
  const date = new Date(day)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day)
}

const Timestamp = Schema.String.check(
  Schema.isPattern(DATE_TIME),
  Schema.makeFilter((timestamp) =>
    Number.isNaN(Date.parse(timestamp)) || !isCalendarDay(timestamp)
      ? `${timestamp} is not a valid date.`
      : undefined,
  ),
)

const isCurrency = Schema.is(Currency)

const Amounts = Schema.Record(
  Schema.String,
  Schema.Int.check(
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(999999999999),
  ),
).check(
  Schema.isMinProperties(1),
  Schema.makeFilter((amounts) =>
    Object.keys(amounts)
      .filter((code) => !isCurrency(code))
      .map((code) => ({ path: [code], issue: `Unknown currency "${code}".` })),
  ),
)

const discountFields = {
  external_id: Schema.String.check(Schema.isMinLength(1)),
  name: Schema.String.check(Schema.isMinLength(1)),
  duration: Schema.Literals(['once', 'forever', 'repeating']),
  duration_in_months: Schema.optionalKey(
    Schema.Int.check(
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(999),
    ),
  ),
  code: Schema.optionalKey(Code),
  starts_at: Schema.optionalKey(Timestamp),
  ends_at: Schema.optionalKey(Timestamp),
  max_redemptions: Schema.optionalKey(Count),
  max_redemptions_per_customer: Schema.optionalKey(Count),
  products: Schema.optionalKey(
    Schema.Array(Schema.String.check(Schema.isMinLength(1))),
  ),
}

export const DiscountConfig = Schema.Union([
  Schema.Struct({
    ...discountFields,
    type: Schema.Literal('percentage'),
    basis_points: Schema.Int.check(
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(10000),
    ),
  }),
  Schema.Struct({
    ...discountFields,
    type: Schema.Literal('fixed'),
    amounts: Amounts,
  }),
]).check(
  Schema.makeFilter(({ duration, duration_in_months }) =>
    (duration === 'repeating') === (duration_in_months !== undefined)
      ? undefined
      : {
          path: ['duration_in_months'],
          issue:
            duration === 'repeating'
              ? 'A repeating discount needs duration_in_months.'
              : 'Only a repeating discount has duration_in_months.',
        },
  ),
  Schema.makeFilter(({ starts_at, ends_at }) =>
    starts_at === undefined ||
    ends_at === undefined ||
    Date.parse(starts_at) < Date.parse(ends_at)
      ? undefined
      : { path: ['ends_at'], issue: 'ends_at must be after starts_at.' },
  ),
)

export type DiscountConfig = typeof DiscountConfig.Type

type Percentage = {
  readonly type: 'percentage'
  readonly basis_points: number
}

type Fixed = {
  readonly type: 'fixed'
  readonly amounts: Amounts
}

type Amounts = readonly [Money<1>, ...Money<1>[]]

type Duration =
  | { readonly duration: 'once' | 'forever' }
  | { readonly duration: 'repeating'; readonly duration_in_months: number }

type Instant = Date | string

type Limits<Product extends string> = {
  readonly code?: string
  readonly products?: ReadonlyArray<Product>
  readonly max_redemptions?: number
  readonly max_redemptions_per_customer?: number
  readonly starts_at?: Instant
  readonly ends_at?: Instant
}

/**
 * Accepts a literal with at most 2 decimals, so `percent(12.345)` fails to
 * compile. A plain `number` passes and is checked when the discount is created.
 */
export type PercentOff<Percent extends number> = number extends Percent
  ? Percent
  : `${Percent}` extends `-${string}`
    ? "Percentages can't be negative"
    : `${Percent}` extends
          | `${bigint}`
          | `${bigint}.${Digit | `${Digit}${Digit}`}`
      ? Percent
      : 'Percentages have at most 2 decimals'

const basisPoints = (percent: unknown): number => {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(percent))
  const [, whole = '', fraction = ''] = match ?? []
  const points = Number(`${whole}${fraction.padEnd(2, '0')}`)
  if (match === null || points < 1 || points > 10000) {
    throw new Error(
      `Percentages must be between 0.01 and 100 with at most 2 decimals, got percent(${percent}).`,
    )
  }
  return points
}

type Unit = 'month' | 'months' | 'year' | 'years'

class DiscountBuilder<
  Product extends string,
  Value extends Percentage | Fixed | undefined,
  D extends Duration | undefined,
> {
  constructor(
    readonly name: string | undefined,
    readonly value: Value,
    readonly duration: D,
    readonly limits: Limits<Product> = {},
  ) {}

  /** A percentage off, with at most 2 decimals: `percent(12.5)` is 12.5% off. */
  percent<const Percent extends number>(
    percent: PercentOff<Percent>,
  ): DiscountBuilder<Product, Percentage, D> {
    return new DiscountBuilder(
      this.name,
      { type: 'percentage', basis_points: basisPoints(percent) },
      this.duration,
      this.limits,
    )
  }

  /** A fixed amount off, one per currency: `amount(usd(10), eur(9))`. */
  amount(...amounts: Amounts): DiscountBuilder<Product, Fixed, D> {
    return new DiscountBuilder(
      this.name,
      { type: 'fixed', amounts },
      this.duration,
      this.limits,
    )
  }

  /** Applies to the first payment only. */
  once(): DiscountBuilder<Product, Value, Duration> {
    return new DiscountBuilder(
      this.name,
      this.value,
      { duration: 'once' },
      this.limits,
    )
  }

  /** Applies to every payment of the subscription. */
  forever(): DiscountBuilder<Product, Value, Duration> {
    return new DiscountBuilder(
      this.name,
      this.value,
      { duration: 'forever' },
      this.limits,
    )
  }

  /** Applies to payments for the given time, counted in months. */
  repeating(
    count: number,
    unit: Unit,
  ): DiscountBuilder<Product, Value, Duration> {
    return new DiscountBuilder(
      this.name,
      this.value,
      {
        duration: 'repeating',
        duration_in_months: unit.startsWith('year') ? count * 12 : count,
      },
      this.limits,
    )
  }

  /** The code customers enter at checkout. Without one, apply it through the API. */
  code(code: string): DiscountBuilder<Product, Value, D> {
    return this.with({ code })
  }

  /** Limits the discount to these products. Without it, it applies to all of them. */
  products(...products: Product[]): DiscountBuilder<Product, Value, D> {
    return this.with({ products })
  }

  maxRedemptions(count: number): DiscountBuilder<Product, Value, D> {
    return this.with({ max_redemptions: count })
  }

  perCustomer(count: number): DiscountBuilder<Product, Value, D> {
    return this.with({ max_redemptions_per_customer: count })
  }

  /** A `Date`, a date such as `'2026-12-31'` or a timestamp with a time zone. */
  starts(date: Instant): DiscountBuilder<Product, Value, D> {
    return this.with({ starts_at: date })
  }

  /** A `Date`, a date such as `'2026-12-31'` or a timestamp with a time zone. */
  ends(date: Instant): DiscountBuilder<Product, Value, D> {
    return this.with({ ends_at: date })
  }

  private with(limits: Limits<Product>): DiscountBuilder<Product, Value, D> {
    return new DiscountBuilder(this.name, this.value, this.duration, {
      ...this.limits,
      ...limits,
    })
  }
}

/** A discount with a value (`.percent()` or `.amount()`) and a duration. */
export type DiscountDefinition<Product extends string = string> =
  DiscountBuilder<Product, Percentage | Fixed, Duration>

export const discount = <Product extends string = string>(
  name?: string,
): DiscountBuilder<Product, undefined, undefined> =>
  new DiscountBuilder(name, undefined, undefined)

const timestamp = (value: unknown, where: string): string => {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string' &&
          (DATE.test(value) || DATE_TIME.test(value)) &&
          isCalendarDay(value)
        ? new Date(value)
        : undefined
  if (date === undefined || Number.isNaN(date.getTime())) {
    throw new Error(
      `${where} must be a Date, a date such as "2026-12-31" or a timestamp with a time zone, got ${String(value)}.`,
    )
  }
  return date.toISOString().replace('.000Z', 'Z')
}

const unique = <Item>(
  items: ReadonlyArray<Item>,
  where: string,
  noun: string,
  keyOf: (item: Item) => string = String,
): ReadonlyArray<Item> => {
  const keys = items.map(keyOf)
  const repeated = keys.find((key, index) => keys.indexOf(key) !== index)
  if (repeated !== undefined) {
    throw new Error(`${where} lists ${noun} "${repeated}" more than once.`)
  }
  return items
}

/** Builds the API shape of a discount, before it is validated. */
export const discountConfig = (
  external_id: string,
  { name, value, duration, limits }: DiscountDefinition,
) => {
  const where = `Discount "${external_id}"`
  if ('code' in limits && typeof limits.code !== 'string') {
    throw new Error(
      `${where} needs a string code, got ${String(limits.code)}. If it comes from an environment variable, check that it is set.`,
    )
  }
  return {
    external_id,
    name: name ?? external_id,
    ...(value.type === 'percentage'
      ? value
      : {
          type: value.type,
          amounts: Object.fromEntries(
            unique(
              value.amounts,
              where,
              'currency',
              ({ currency }) => currency,
            ).map(({ currency, amount }) => [currency, amount]),
          ),
        }),
    ...duration,
    ...(limits.code !== undefined && { code: limits.code }),
    ...(limits.starts_at !== undefined && {
      starts_at: timestamp(limits.starts_at, `The start date of ${where}`),
    }),
    ...(limits.ends_at !== undefined && {
      ends_at: timestamp(limits.ends_at, `The end date of ${where}`),
    }),
    ...(limits.max_redemptions !== undefined && {
      max_redemptions: limits.max_redemptions,
    }),
    ...(limits.max_redemptions_per_customer !== undefined && {
      max_redemptions_per_customer: limits.max_redemptions_per_customer,
    }),
    ...(limits.products !== undefined && {
      products: unique(limits.products, where, 'product'),
    }),
  }
}

export type DiscountHelpers<Product extends string> = {
  readonly discount: (
    name?: string,
  ) => DiscountBuilder<Product, undefined, undefined>
}
