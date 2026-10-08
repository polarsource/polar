import { Schema } from 'effect'
import type { Currency } from './money'
import {
  fixed,
  free,
  metered,
  PriceConfig,
  priceConfigs,
  priceCurrencies,
  sameCurrencies,
  seats,
  tier,
  units,
} from './price'
import type { PriceDefinition } from './price'

const IntervalUnit = Schema.Literals(['day', 'week', 'month', 'year'])

type IntervalUnit = typeof IntervalUnit.Type

const AT_MOST_ONE = {
  fixed: 'Only one fixed or free price is allowed.',
  seat_based: 'Only one seat-based price is allowed.',
  unit_based: 'Only one unit-based price is allowed.',
} as const

// Mirrors the backend: per currency, a product may combine one fixed price
// with one seat-based or unit-based price, plus one metered price per meter.
const compositionIssues = (
  prices: ReadonlyArray<PriceConfig>,
): ReadonlyArray<string> => {
  const issues = new Set<string>()
  const currencies = new Set(prices.map(({ price_currency }) => price_currency))
  for (const currency of currencies) {
    const inCurrency = prices.filter(
      ({ price_currency }) => price_currency === currency,
    )
    const count = (type: PriceConfig['amount_type']) =>
      inCurrency.filter(({ amount_type }) => amount_type === type).length
    for (const [type, issue] of Object.entries(AT_MOST_ONE)) {
      if (count(type as keyof typeof AT_MOST_ONE) > 1) issues.add(issue)
    }
    if (count('seat_based') > 0 && count('unit_based') > 0) {
      issues.add(
        'A seat-based price cannot be combined with a unit-based price.',
      )
    }
    const meters = inCurrency.flatMap((price) =>
      'meter' in price ? [price.meter] : [],
    )
    meters
      .filter((meter, index) => meters.indexOf(meter) !== index)
      .forEach((meter) =>
        issues.add(`Meter "${meter}" is used by more than one price.`),
      )
  }
  return [...issues]
}

export const ProductConfig = Schema.Struct({
  external_id: Schema.String.check(Schema.isMinLength(1)),
  name: Schema.String.check(Schema.isMinLength(3), Schema.isMaxLength(64)),
  recurring_interval: Schema.NullOr(IntervalUnit),
  recurring_interval_count: Schema.NullOr(
    Schema.Int.check(
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(999),
    ),
  ),
  trial_interval: Schema.optionalKey(IntervalUnit),
  trial_interval_count: Schema.optionalKey(
    Schema.Int.check(
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(1000),
    ),
  ),
  prices: Schema.Array(PriceConfig).check(Schema.isMinLength(1)),
  benefits: Schema.Array(Schema.String),
}).check(
  Schema.makeFilter(({ prices }) =>
    compositionIssues(prices).map((issue) => ({ path: ['prices'], issue })),
  ),
)

export type ProductConfig = typeof ProductConfig.Type

type Interval = IntervalUnit | `${IntervalUnit}s`

const cadences = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
} as const satisfies Record<string, IntervalUnit>

const unitOf = (interval: Interval): IntervalUnit =>
  interval.endsWith('s')
    ? (interval.slice(0, -1) as IntervalUnit)
    : (interval as IntervalUnit)

type Recurring = {
  readonly recurring_interval: IntervalUnit
  readonly recurring_interval_count: number
}

type OneTime = {
  readonly recurring_interval: null
  readonly recurring_interval_count: null
}

type Trial = {
  readonly trial_interval: IntervalUnit
  readonly trial_interval_count: number
}

type Prices<Meter extends string> = readonly [
  PriceDefinition<Meter>,
  ...PriceDefinition<Meter>[],
]

class ProductBuilder<
  Meter extends string,
  Benefit extends string,
  P extends Prices<Meter> | undefined,
  Billing extends Recurring | OneTime | undefined,
> {
  constructor(
    readonly name: string | undefined,
    readonly priceList: P,
    readonly billing: Billing,
    readonly trialPeriod: Trial | undefined = undefined,
    readonly benefits: ReadonlyArray<Benefit> = [],
  ) {}

  prices(
    ...prices: Prices<Meter>
  ): ProductBuilder<Meter, Benefit, Prices<Meter>, Billing> {
    return new ProductBuilder(
      this.name,
      prices,
      this.billing,
      this.trialPeriod,
      this.benefits,
    )
  }

  recurring(
    cadence: keyof typeof cadences,
  ): ProductBuilder<Meter, Benefit, P, Recurring>
  recurring(
    count: number,
    interval: Interval,
  ): ProductBuilder<Meter, Benefit, P, Recurring>
  recurring(
    ...args:
      | [cadence: keyof typeof cadences]
      | [count: number, interval: Interval]
  ): ProductBuilder<Meter, Benefit, P, Recurring> {
    const billing: Recurring =
      args.length === 1
        ? { recurring_interval: cadences[args[0]], recurring_interval_count: 1 }
        : {
            recurring_interval: unitOf(args[1]),
            recurring_interval_count: args[0],
          }
    return new ProductBuilder(
      this.name,
      this.priceList,
      billing,
      this.trialPeriod,
      this.benefits,
    )
  }

  once(): ProductBuilder<Meter, Benefit, P, OneTime> {
    return new ProductBuilder(
      this.name,
      this.priceList,
      { recurring_interval: null, recurring_interval_count: null },
      undefined,
      this.benefits,
    )
  }

  trial(
    this: ProductBuilder<Meter, Benefit, P, Recurring>,
    count: number,
    interval: Interval,
  ): ProductBuilder<Meter, Benefit, P, Recurring> {
    return new ProductBuilder(
      this.name,
      this.priceList,
      this.billing,
      { trial_interval: unitOf(interval), trial_interval_count: count },
      this.benefits,
    )
  }

  grants(
    benefits: ReadonlyArray<Benefit>,
  ): ProductBuilder<Meter, Benefit, P, Billing> {
    return new ProductBuilder(
      this.name,
      this.priceList,
      this.billing,
      this.trialPeriod,
      benefits,
    )
  }
}

/** A product with prices and a billing cycle (`.recurring()` or `.once()`). */
export type ProductDefinition<
  Meter extends string = string,
  Benefit extends string = string,
> = ProductBuilder<Meter, Benefit, Prices<Meter>, Recurring | OneTime>

export const product = <
  Meter extends string = string,
  Benefit extends string = string,
>(
  name?: string,
): ProductBuilder<Meter, Benefit, undefined, undefined> =>
  new ProductBuilder(name, undefined, undefined)

/**
 * Every price in a product must be set in the same currencies, so each
 * currency gets the same pricing structure.
 */
export const productPrices = (
  external_id: string,
  { priceList, billing }: ProductDefinition,
): ReadonlyArray<PriceConfig> => {
  const where = (index: number) =>
    `Price ${index + 1} of product "${external_id}"`
  if (
    billing.recurring_interval === null &&
    priceList.some((price) => price.kind === 'metered')
  ) {
    throw new Error(
      `Product "${external_id}" is a one-time purchase, so it can't have metered prices.`,
    )
  }
  let currencies: ReadonlyArray<Currency> | undefined
  priceList.forEach((price, index) => {
    const own = priceCurrencies(price, where(index))
    if (own === undefined) return
    if (currencies === undefined) {
      currencies = own
    } else if (!sameCurrencies(own, currencies)) {
      throw new Error(
        `${where(index)} must have amounts in the same currencies as the product's other prices (${currencies.join(', ')}).`,
      )
    }
  })
  return priceList.flatMap((price, index) =>
    priceConfigs(price, currencies ?? ['usd'], where(index)),
  )
}

export type ProductHelpers<Meter extends string, Benefit extends string> = {
  readonly product: (
    name?: string,
  ) => ProductBuilder<Meter, Benefit, undefined, undefined>
  readonly free: typeof free
  readonly fixed: typeof fixed
  readonly seats: typeof seats
  readonly units: typeof units
  readonly tier: typeof tier
  readonly meter: (meter: Meter) => ReturnType<typeof metered<Meter>>
}
