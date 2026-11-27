import { Schema } from 'effect'
import { Currency, DecimalAmount, unitAmount, WholeAmount } from './money'
import type { Money, Scale } from './money'

const Units = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))
const Cents = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

export const TaxBehavior = Schema.Literals([
  'location',
  'inclusive',
  'exclusive',
])

export type TaxBehavior = typeof TaxBehavior.Type

const taxField = { tax_behavior: Schema.optionalKey(TaxBehavior) }

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

const UnitNoun = Schema.String.check(
  Schema.makeFilter((value) =>
    value.trim().length > 0 ? undefined : 'Unit labels must not be blank.',
  ),
  Schema.isMaxLength(32),
)

// For now we only support `en`, wider i18n support maybe in future
const UnitLabelConfig = Schema.Struct({
  en: Schema.Struct({ '=1': UnitNoun, other: UnitNoun }),
})

const quantityFields = {
  ...taxField,
  price_currency: Currency,
  tiers: tiersOf(WholeAmount),
  minimum_units: Schema.optionalKey(Units),
}

const minimumWithinTiers = Schema.makeFilter(
  ({
    tiers,
    minimum_units,
  }: {
    readonly tiers: {
      readonly tiers: ReadonlyArray<{ readonly bound?: number }>
    }
    readonly minimum_units?: number
  }) => {
    const maximum = tiers.tiers[tiers.tiers.length - 1]?.bound
    return minimum_units === undefined ||
      maximum === undefined ||
      minimum_units <= maximum
      ? undefined
      : {
          path: ['minimum_units'],
          issue: `The minimum of ${minimum_units} exceeds the maximum of ${maximum}.`,
        }
  },
)

const meteredFields = {
  ...taxField,
  price_currency: Currency,
  meter: Schema.String.check(Schema.isMinLength(1)),
  cap_amount: Schema.optionalKey(
    Cents.check(Schema.isLessThanOrEqualTo(2147483647)),
  ),
}

export const PriceConfig = Schema.Union([
  Schema.Struct({
    ...taxField,
    amount_type: Schema.Literal('fixed'),
    price_currency: Currency,
    price_amount: Cents,
  }),
  Schema.Struct({
    ...quantityFields,
    amount_type: Schema.Literal('seat_based'),
  }).check(minimumWithinTiers),
  Schema.Struct({
    ...quantityFields,
    amount_type: Schema.Literal('unit_based'),
    unit_label: Schema.optionalKey(UnitLabelConfig),
  }).check(minimumWithinTiers),
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

type Amounts<Rate extends Money> = readonly [amount: Rate, ...amounts: Rate[]]

/** A tier without amounts is free: 0 in each currency the price uses. */
export interface TierOf<Rate extends Money = Money> {
  readonly bound: number | undefined
  readonly amounts: ReadonlyArray<Rate>
}

type TierList<T> = readonly [tier: T, ...tiers: T[]]

type Tiers<Rate extends Money> = TierList<TierOf<Rate>>

/** Volume pricing charges every unit at the matching tier's rate, so no units are ever included. */
type VolumeTierOf<Rate extends Money> = TierOf<Rate> & {
  readonly included?: never
}

type Tier = TierOf<Money<1>>
type VolumeTier = VolumeTierOf<Money<1>>
/** Usage tiers can charge per thousand or per million units. */
type UsageTier = TierOf<Money>
type UsageVolumeTier = VolumeTierOf<Money>

class PricedTier<Rate extends Money> implements TierOf<Rate> {
  constructor(
    readonly bound: number | undefined,
    readonly amounts: ReadonlyArray<Rate>,
  ) {}

  /** The last unit this tier covers. The next tier starts after it. */
  max(lastUnit: number): PricedTier<Rate> {
    return new PricedTier(lastUnit, this.amounts)
  }
}

class IncludedTier extends PricedTier<never> {
  readonly included = true
}

const volumeTiers = <Rate extends Money>(
  tiers: TierList<VolumeTierOf<Rate>>,
): Tiers<Rate> => {
  if (tiers.some((tier) => tier instanceof IncludedTier)) {
    throw new Error(
      'Volume pricing charges every unit at its tier rate, so it has no included units. Use .graduated() or tier().max(units).free().',
    )
  }
  return tiers
}

class TierBuilder {
  constructor(private readonly bound: number | undefined = undefined) {}

  /** The last unit this tier covers. The next tier starts after it. */
  max(lastUnit: number): TierBuilder {
    return new TierBuilder(lastUnit)
  }

  /** The rate for each unit in this tier, one amount per currency. */
  amount<Per extends Scale>(
    ...amounts: Amounts<Money<Per>>
  ): PricedTier<Money<Per>> {
    return new PricedTier(this.bound, amounts)
  }

  /** Charges 0 in each currency the price's other tiers use. */
  free(): PricedTier<never> {
    return new PricedTier(this.bound, [])
  }

  /** The first `units` units are free. Only for graduated pricing. */
  included(units: number): IncludedTier {
    return new IncludedTier(units, [])
  }
}

/** A tier is unbounded unless you set `.max()`. Only the last tier may be unbounded. */
export const tier = (): TierBuilder => new TierBuilder()

type Structure = 'flat' | TiersConfig['type']

type QuantityType = 'seat_based' | 'unit_based'

type Bounds = { readonly minimum?: number; readonly maximum?: number }

type UnitLabel = { readonly singular: string; readonly plural: string }

const clonePrice = <Price extends object>(
  price: Price,
  patch: Partial<Price>,
): Price =>
  Object.assign(
    Object.create(Object.getPrototypeOf(price) as object) as Price,
    price,
    patch,
  )

abstract class TaxablePrice {
  readonly taxBehavior: TaxBehavior | undefined = undefined

  /**
   * Whether the amount includes tax or has it added at checkout. `'location'`
   * excludes it in the US, Canada and India and includes it elsewhere.
   * Defaults to the organization's setting.
   */
  tax(behavior: TaxBehavior): this {
    return clonePrice(this, { taxBehavior: behavior } as Partial<this>)
  }
}

export class FreePrice {
  readonly kind = 'free'
}

export class FixedPrice extends TaxablePrice {
  readonly kind = 'fixed'

  constructor(readonly amounts: Amounts<Money<1>>) {
    super()
  }
}

export class QuantityPrice<
  Type extends QuantityType = QuantityType,
> extends TaxablePrice {
  readonly kind = 'quantity'

  constructor(
    readonly type: Type,
    readonly structure: Structure,
    readonly tiers: Tiers<Money<1>>,
    readonly bounds: Bounds = {},
    readonly unitLabel?: UnitLabel,
  ) {
    super()
  }

  /** The smallest quantity a customer can buy. Defaults to 1. */
  min(minimum: number): QuantityPrice<Type> {
    return clonePrice<QuantityPrice<Type>>(this, {
      bounds: { ...this.bounds, minimum },
    })
  }

  /** The largest quantity a customer can buy. Unlimited by default. */
  max(maximum: number): QuantityPrice<Type> {
    return clonePrice<QuantityPrice<Type>>(this, {
      bounds: { ...this.bounds, maximum },
    })
  }

  /** The unit name shown at checkout, in the customer portal and on invoices. Defaults to "unit"/"units". */
  label(
    this: QuantityPrice<'unit_based'>,
    singular: string,
    plural: string,
  ): QuantityPrice<'unit_based'> {
    return clonePrice<QuantityPrice<'unit_based'>>(this, {
      unitLabel: { singular, plural },
    })
  }
}

export class MeteredPrice<Meter extends string> extends TaxablePrice {
  readonly kind = 'metered'

  constructor(
    readonly meter: Meter,
    readonly structure: Structure,
    readonly tiers: Tiers<Money>,
    readonly caps: ReadonlyArray<Money<1>> = [],
  ) {
    super()
  }

  /** The most customers pay for this usage per period, however much they use. One amount per currency. */
  cap(...caps: Amounts<Money<1>>): MeteredPrice<Meter> {
    return clonePrice<MeteredPrice<Meter>>(this, { caps })
  }
}

export type PriceDefinition<Meter extends string = string> =
  | FreePrice
  | FixedPrice
  | QuantityPrice
  | MeteredPrice<Meter>

class FixedBuilder {
  /** The price, one amount per currency. */
  amount(...amounts: Amounts<Money<1>>): FixedPrice {
    return new FixedPrice(amounts)
  }
}

class FlatQuantityBuilder<Type extends QuantityType> {
  constructor(
    private readonly type: Type,
    private readonly bounds: Bounds = {},
  ) {}

  /** The smallest quantity a customer can buy. Defaults to 1. */
  min(minimum: number): FlatQuantityBuilder<Type> {
    return new FlatQuantityBuilder(this.type, { ...this.bounds, minimum })
  }

  /** The largest quantity a customer can buy. Unlimited by default. */
  max(maximum: number): FlatQuantityBuilder<Type> {
    return new FlatQuantityBuilder(this.type, { ...this.bounds, maximum })
  }

  /** The price of each unit, one amount per currency. */
  amount(...amounts: Amounts<Money<1>>): QuantityPrice<Type> {
    return new QuantityPrice(
      this.type,
      'flat',
      [new PricedTier(undefined, amounts)],
      this.bounds,
    )
  }
}

class QuantityBuilder<Type extends QuantityType> {
  constructor(private readonly type: Type) {}

  /** Every unit costs the same. */
  flat(): FlatQuantityBuilder<Type> {
    return new FlatQuantityBuilder(this.type)
  }

  /** Each tier charges its own rate for the units in it. The total is the sum across tiers. */
  graduated(...tiers: TierList<Tier>): QuantityPrice<Type> {
    return new QuantityPrice(this.type, 'graduated', tiers)
  }

  /** The total quantity sets the rate, and that rate applies to every unit. */
  volume(...tiers: TierList<VolumeTier>): QuantityPrice<Type> {
    return new QuantityPrice(this.type, 'volume', volumeTiers(tiers))
  }
}

class FlatMeteredBuilder<Meter extends string> {
  constructor(private readonly meter: Meter) {}

  /**
   * The price of each unit of usage, one amount per currency. Use
   * `perThousand()` or `perMillion()` for fractions of a cent.
   */
  amount(...amounts: Amounts<Money>): MeteredPrice<Meter> {
    return new MeteredPrice(this.meter, 'flat', [
      new PricedTier(undefined, amounts),
    ])
  }
}

class MeteredBuilder<Meter extends string> {
  constructor(private readonly meter: Meter) {}

  /** Every unit of usage costs the same. */
  flat(): FlatMeteredBuilder<Meter> {
    return new FlatMeteredBuilder(this.meter)
  }

  /** Each tier charges its own rate for the units in it. The total is the sum across tiers. */
  graduated(...tiers: TierList<UsageTier>): MeteredPrice<Meter> {
    return new MeteredPrice(this.meter, 'graduated', tiers)
  }

  /** The total usage in the period sets the rate, and that rate applies to every unit. */
  volume(...tiers: TierList<UsageVolumeTier>): MeteredPrice<Meter> {
    return new MeteredPrice(this.meter, 'volume', volumeTiers(tiers))
  }
}

/** A fixed price of 0 in each currency the product's other prices use (USD when there are none). */
export const free = (): FreePrice => new FreePrice()
/** Charges one set amount. */
export const fixed = (): FixedBuilder => new FixedBuilder()
/** Charges per seat. The buyer assigns seats to team members, who each get the product's benefits. */
export const seats = (): QuantityBuilder<'seat_based'> =>
  new QuantityBuilder('seat_based')
/** Charges per unit, paid up front. Customers pick a quantity and get each benefit once. */
export const units = (): QuantityBuilder<'unit_based'> =>
  new QuantityBuilder('unit_based')
/** Charges for what a meter records, billed at the end of each period. */
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
): ReadonlyArray<TierOf<Rate>> => {
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
  tiers: ReadonlyArray<TierOf>,
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
    const tax =
      price.kind === 'free' || price.taxBehavior === undefined
        ? {}
        : { tax_behavior: price.taxBehavior }
    switch (price.kind) {
      case 'free':
        return {
          amount_type: 'fixed',
          price_currency: currency,
          price_amount: 0,
        }
      case 'fixed':
        return {
          ...tax,
          amount_type: 'fixed',
          price_currency: currency,
          price_amount: amountIn(price.amounts, currency).amount,
        }
      case 'quantity': {
        const { minimum, maximum } = price.bounds
        const fields = {
          ...tax,
          price_currency: currency,
          tiers: tiersConfig(
            price.structure === 'graduated' ? 'graduated' : 'volume',
            boundedTiers(price.tiers, maximum, where),
            currency,
          ),
          ...(minimum !== undefined && { minimum_units: minimum }),
        }
        return price.type === 'seat_based'
          ? { ...fields, amount_type: 'seat_based' }
          : {
              ...fields,
              amount_type: 'unit_based',
              ...(price.unitLabel !== undefined && {
                unit_label: {
                  en: {
                    '=1': price.unitLabel.singular,
                    other: price.unitLabel.plural,
                  },
                },
              }),
            }
      }
      case 'metered': {
        const cap = price.caps.find((money) => money.currency === currency)
        const fields = {
          ...tax,
          price_currency: currency,
          meter: price.meter,
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
