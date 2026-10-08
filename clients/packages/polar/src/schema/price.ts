import { Schema } from 'effect'
import { Currency, DecimalAmount, unitAmount, WholeAmount } from './money'
import type { Money } from './money'

const Units = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))
const Cents = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

const tiersOf = <Amount extends typeof DecimalAmount>(amount: Amount) =>
  Schema.Struct({
    type: Schema.Literals(['volume', 'graduated']),
    tiers: Schema.Array(
      Schema.Struct({
        bound: Schema.optionalKey(Units),
        unit_amount: amount,
      }),
    ).check(Schema.isMinLength(1)),
  })

const TiersConfig = tiersOf(DecimalAmount)

type TiersConfig = typeof TiersConfig.Type

const meteredFields = {
  price_currency: Currency,
  meter_external_id: Schema.String.check(Schema.isMinLength(1)),
  cap_amount: Schema.optionalKey(Cents),
}

export const PriceConfig = Schema.Union([
  Schema.Struct({
    amount_type: Schema.Literal('fixed'),
    price_currency: Currency,
    price_amount: Cents,
  }),
  Schema.Struct({
    amount_type: Schema.Literals(['seat_based', 'unit_based']),
    price_currency: Currency,
    tiers: tiersOf(WholeAmount),
    minimum_units: Schema.optionalKey(Units),
  }).check(
    Schema.makeFilter(({ tiers, minimum_units }) => {
      const maximum = tiers.tiers[tiers.tiers.length - 1]?.bound
      return minimum_units === undefined ||
        maximum === undefined ||
        minimum_units <= maximum
        ? undefined
        : {
            path: ['minimum_units'],
            issue: `The minimum of ${minimum_units} exceeds the maximum of ${maximum}.`,
          }
    }),
  ),
  Schema.Struct({
    ...meteredFields,
    amount_type: Schema.Literal('metered_unit'),
    unit_amount: DecimalAmount.check(
      Schema.makeFilter((amount) =>
        Number(amount) > 0
          ? undefined
          : 'Flat metered prices need a rate above 0.',
      ),
    ),
  }),
  Schema.Struct({
    ...meteredFields,
    amount_type: Schema.Literal('metered_tiers'),
    tiers: TiersConfig,
  }),
])

export type PriceConfig = typeof PriceConfig.Type

type Amounts<Rate extends Money> = readonly [Rate, ...Rate[]]

/** A tier without amounts is free: 0 in each currency the price uses. */
export interface Tier<Rate extends Money = Money> {
  readonly bound: number | undefined
  readonly amounts: ReadonlyArray<Rate>
}

type Tiers<Rate extends Money> = readonly [Tier<Rate>, ...Tier<Rate>[]]

class PricedTier<Rate extends Money> implements Tier<Rate> {
  constructor(
    readonly bound: number | undefined,
    readonly amounts: ReadonlyArray<Rate>,
  ) {}

  max(bound: number): PricedTier<Rate> {
    return new PricedTier(bound, this.amounts)
  }
}

class TierBuilder {
  constructor(private readonly bound: number | undefined = undefined) {}

  max(bound: number): TierBuilder {
    return new TierBuilder(bound)
  }

  amount<const Rates extends Amounts<Money>>(
    ...amounts: Rates
  ): PricedTier<Rates[number]> {
    return new PricedTier(this.bound, amounts)
  }

  /** Charges 0 in each currency the price's other tiers use. */
  free(): PricedTier<never> {
    return new PricedTier(this.bound, [])
  }

  /** The first `units` units are free: shorthand for `.max(units).free()`. */
  included(units: number): PricedTier<never> {
    return new PricedTier(units, [])
  }
}

/** A tier is unbounded unless you set `.max()`. Only the last tier may be unbounded. */
export const tier = (): TierBuilder => new TierBuilder()

type Structure = 'flat' | TiersConfig['type']

type QuantityType = 'seat_based' | 'unit_based'

type Bounds = { readonly minimum?: number; readonly maximum?: number }

export class FreePrice {
  readonly kind = 'free'
}

export class FixedPrice {
  readonly kind = 'fixed'

  constructor(readonly amounts: Amounts<Money<1>>) {}
}

export class QuantityPrice {
  readonly kind = 'quantity'

  constructor(
    readonly type: QuantityType,
    readonly structure: Structure,
    readonly tiers: Tiers<Money<1>>,
    readonly bounds: Bounds = {},
  ) {}

  min(minimum: number): QuantityPrice {
    return new QuantityPrice(this.type, this.structure, this.tiers, {
      ...this.bounds,
      minimum,
    })
  }

  max(maximum: number): QuantityPrice {
    return new QuantityPrice(this.type, this.structure, this.tiers, {
      ...this.bounds,
      maximum,
    })
  }
}

export class MeteredPrice<Meter extends string> {
  readonly kind = 'metered'

  constructor(
    readonly meter: Meter,
    readonly structure: Structure,
    readonly tiers: Tiers<Money>,
    readonly caps: ReadonlyArray<Money<1>> = [],
  ) {}

  cap(...caps: Amounts<Money<1>>): MeteredPrice<Meter> {
    return new MeteredPrice(this.meter, this.structure, this.tiers, caps)
  }
}

export type PriceDefinition<Meter extends string = string> =
  | FreePrice
  | FixedPrice
  | QuantityPrice
  | MeteredPrice<Meter>

class FixedBuilder {
  amount(...amounts: Amounts<Money<1>>): FixedPrice {
    return new FixedPrice(amounts)
  }
}

class FlatQuantityBuilder {
  constructor(
    private readonly type: QuantityType,
    private readonly bounds: Bounds = {},
  ) {}

  min(minimum: number): FlatQuantityBuilder {
    return new FlatQuantityBuilder(this.type, { ...this.bounds, minimum })
  }

  max(maximum: number): FlatQuantityBuilder {
    return new FlatQuantityBuilder(this.type, { ...this.bounds, maximum })
  }

  amount(...amounts: Amounts<Money<1>>): QuantityPrice {
    return new QuantityPrice(
      this.type,
      'flat',
      [new PricedTier(undefined, amounts)],
      this.bounds,
    )
  }
}

class QuantityBuilder {
  constructor(private readonly type: QuantityType) {}

  flat(): FlatQuantityBuilder {
    return new FlatQuantityBuilder(this.type)
  }

  graduated(...tiers: Tiers<Money<1>>): QuantityPrice {
    return new QuantityPrice(this.type, 'graduated', tiers)
  }

  volume(...tiers: Tiers<Money<1>>): QuantityPrice {
    return new QuantityPrice(this.type, 'volume', tiers)
  }
}

class FlatMeteredBuilder<Meter extends string> {
  constructor(private readonly meter: Meter) {}

  amount(...amounts: Amounts<Money>): MeteredPrice<Meter> {
    return new MeteredPrice(this.meter, 'flat', [
      new PricedTier(undefined, amounts),
    ])
  }
}

class MeteredBuilder<Meter extends string> {
  constructor(private readonly meter: Meter) {}

  flat(): FlatMeteredBuilder<Meter> {
    return new FlatMeteredBuilder(this.meter)
  }

  graduated(...tiers: Tiers<Money>): MeteredPrice<Meter> {
    return new MeteredPrice(this.meter, 'graduated', tiers)
  }

  volume(...tiers: Tiers<Money>): MeteredPrice<Meter> {
    return new MeteredPrice(this.meter, 'volume', tiers)
  }
}

/** A fixed price of 0 in each currency the product's other prices use (USD when there are none). */
export const free = (): FreePrice => new FreePrice()
export const fixed = (): FixedBuilder => new FixedBuilder()
export const seats = (): QuantityBuilder => new QuantityBuilder('seat_based')
export const units = (): QuantityBuilder => new QuantityBuilder('unit_based')
export const metered = <const Meter extends string>(
  meter: Meter,
): MeteredBuilder<Meter> => new MeteredBuilder(meter)

const currenciesOf = (
  amounts: ReadonlyArray<Money>,
  where: string,
): ReadonlyArray<Currency> => {
  const currencies = amounts.map(({ currency }) => currency)
  if (new Set(currencies).size !== currencies.length) {
    throw new Error(`${where} lists the same currency more than once.`)
  }
  return currencies
}

export const sameCurrencies = (
  a: ReadonlyArray<Currency>,
  b: ReadonlyArray<Currency>,
): boolean => a.length === b.length && a.every((code) => b.includes(code))

const amountIn = <Rate extends Money>(
  amounts: ReadonlyArray<Rate>,
  currency: Currency,
): Rate => {
  const money = amounts.find((amount) => amount.currency === currency)
  if (money === undefined) {
    throw new Error(`Missing an amount in ${currency}.`)
  }
  return money
}

const boundedTiers = <Rate extends Money>(
  tiers: Tiers<Rate>,
  maximum: number | undefined,
  where: string,
): ReadonlyArray<Tier<Rate>> => {
  const lastIndex = tiers.length - 1
  if (maximum !== undefined && tiers[lastIndex]?.bound !== undefined) {
    throw new Error(
      `${where} can't set .max() when its last tier already has a .max().`,
    )
  }
  const bounded =
    maximum === undefined
      ? tiers
      : tiers.map((tier, index) =>
          index === lastIndex ? { ...tier, bound: maximum } : tier,
        )
  bounded.forEach(({ bound }, index) => {
    const previous = bounded[index - 1]
    if (previous === undefined) return
    if (previous.bound === undefined) {
      throw new Error(`${where} can only leave its last tier unbounded.`)
    }
    if (bound !== undefined && bound <= previous.bound) {
      throw new Error(
        `${where} needs increasing tier bounds, got ${bound} after ${previous.bound}.`,
      )
    }
  })
  return bounded
}

/**
 * Returns the currencies a price is set in, after checking that every tier
 * and cap uses those same currencies. A free price, or one whose tiers are
 * all free, has none of its own.
 */
export const priceCurrencies = (
  price: PriceDefinition,
  where: string,
): ReadonlyArray<Currency> | undefined => {
  switch (price.kind) {
    case 'free':
      return undefined
    case 'fixed':
      return currenciesOf(price.amounts, where)
    case 'quantity':
    case 'metered': {
      let currencies: ReadonlyArray<Currency> | undefined
      price.tiers.forEach((tier, index) => {
        if (tier.amounts.length === 0) return
        const tierWhere = `${where} tier ${index + 1}`
        const own = currenciesOf(tier.amounts, tierWhere)
        if (currencies === undefined) {
          currencies = own
        } else if (!sameCurrencies(own, currencies)) {
          throw new Error(
            `${tierWhere} must have amounts in the same currencies as the price's other tiers (${currencies.join(', ')}).`,
          )
        }
      })
      if (currencies === undefined) {
        if (price.kind === 'metered' && price.caps.length > 0) {
          throw new Error(`${where} has a cap, but every tier is free.`)
        }
        return undefined
      }
      if (price.kind === 'metered') {
        const priced = currencies
        const unknown = currenciesOf(price.caps, `${where} cap`).filter(
          (code) => !priced.includes(code),
        )
        if (unknown.length > 0) {
          throw new Error(
            `${where} has a cap in ${unknown.join(', ')}, which it has no amounts in.`,
          )
        }
      }
      return currencies
    }
  }
}

const tiersConfig = (
  type: TiersConfig['type'],
  tiers: ReadonlyArray<Tier>,
  currency: Currency,
): TiersConfig => ({
  type,
  tiers: tiers.map(({ bound, amounts }) => ({
    ...(bound !== undefined && { bound }),
    unit_amount:
      amounts.length === 0 ? '0' : unitAmount(amountIn(amounts, currency)),
  })),
})

/** Expands a price into one API price per currency. */
export const priceConfigs = (
  price: PriceDefinition,
  currencies: ReadonlyArray<Currency>,
  where: string,
): ReadonlyArray<PriceConfig> =>
  currencies.map((currency): PriceConfig => {
    switch (price.kind) {
      case 'free':
        return {
          amount_type: 'fixed',
          price_currency: currency,
          price_amount: 0,
        }
      case 'fixed':
        return {
          amount_type: 'fixed',
          price_currency: currency,
          price_amount: amountIn(price.amounts, currency).amount,
        }
      case 'quantity': {
        const { minimum, maximum } = price.bounds
        return {
          amount_type: price.type,
          price_currency: currency,
          tiers: tiersConfig(
            price.structure === 'graduated' ? 'graduated' : 'volume',
            boundedTiers(price.tiers, maximum, where),
            currency,
          ),
          ...(minimum !== undefined && { minimum_units: minimum }),
        }
      }
      case 'metered': {
        const cap = price.caps.find((money) => money.currency === currency)
        const fields = {
          price_currency: currency,
          meter_external_id: price.meter,
          ...(cap !== undefined && { cap_amount: cap.amount }),
        }
        if (price.structure === 'flat') {
          return {
            ...fields,
            amount_type: 'metered_unit',
            unit_amount: unitAmount(amountIn(price.tiers[0].amounts, currency)),
          }
        }
        const tiers = boundedTiers(price.tiers, undefined, where)
        if (tiers[tiers.length - 1]?.bound !== undefined) {
          throw new Error(
            `${where} must leave its last tier unbounded, since usage has no upper limit.`,
          )
        }
        return {
          ...fields,
          amount_type: 'metered_tiers',
          tiers: tiersConfig(price.structure, tiers, currency),
        }
      }
    }
  })
