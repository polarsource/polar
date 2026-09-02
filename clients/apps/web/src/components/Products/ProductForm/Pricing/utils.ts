import Big from 'big.js'
import { schemas } from '@polar-sh/client'
import { FreeProductPriceCreate, ProductFormType } from '../ProductForm'

export type ProductPrice = schemas['ProductPrice']
// Includes the UI-only `free` price type (converted to a fixed price of 0 on submit).
export type ProductPriceCreate =
  | schemas['ProductCreate']['prices'][number]
  | FreeProductPriceCreate
export type AnyPrice = NonNullable<ProductFormType['prices']>[number]
export type PriceEntry = { price: AnyPrice; index: number }

// The meter cycle governs meter resets, meter-credit grants and overage settlement, so it
// only earns its place once the product has something metered — a metered price or a
// meter-credit benefit — in an organization the feature is rolled out to. An existing
// product shows its saved cycle regardless: the API accepts `meter_interval` on create
// only, so there it's a read-only fact, not a choice, and hiding it would hide a setting
// the product is already billing on.
export const shouldShowMeterCycle = ({
  isEnabledForOrganization,
  isRecurring,
  hasMeteredPrice,
  hasMeterCreditBenefit,
  hasSavedMeterCycle,
}: {
  isEnabledForOrganization: boolean
  isRecurring: boolean
  hasMeteredPrice: boolean
  hasMeterCreditBenefit: boolean
  hasSavedMeterCycle: boolean
}): boolean => {
  if (hasSavedMeterCycle) {
    return isRecurring
  }
  return (
    isEnabledForOrganization &&
    isRecurring &&
    (hasMeteredPrice || hasMeterCreditBenefit)
  )
}

export const hasPriceCurrency = (
  price: AnyPrice,
): price is AnyPrice & { price_currency: string } => {
  return 'price_currency' in price && typeof price.price_currency === 'string'
}

export const groupPricesByCurrency = (
  prices: ProductFormType['prices'],
): Map<string, PriceEntry[]> => {
  const grouped = new Map<string, PriceEntry[]>()
  if (!prices) return grouped
  for (let index = 0; index < prices.length; index++) {
    const price = prices[index]
    if (hasPriceCurrency(price)) {
      const currency = price.price_currency || 'usd'
      if (!grouped.has(currency)) {
        grouped.set(currency, [])
      }
      grouped.get(currency)!.push({ price, index })
    }
  }
  return grouped
}

export const getActiveCurrencies = (
  prices: ProductFormType['prices'],
): string[] => {
  const currencies = new Set<string>()
  if (!prices) return []
  for (const price of prices) {
    if (hasPriceCurrency(price)) {
      currencies.add(price.price_currency || 'usd')
    }
  }
  return Array.from(currencies)
}

type MeteredTiers = schemas['ProductPriceMeteredTiers']['tiers']

const tieredCost = (
  { type: tierType, tiers }: MeteredTiers,
  units: number,
): Big => {
  const parsed = tiers
    .map((tier) => ({
      bound: tier.bound ?? null,
      unitAmount: String(tier.unit_amount),
    }))
    .sort(
      (a, b) =>
        Number(a.bound === null) - Number(b.bound === null) ||
        (a.bound ?? 0) - (b.bound ?? 0),
    )

  if (tierType === 'volume') {
    const tier = parsed.find((t) => t.bound === null || units <= t.bound)
    return tier ? new Big(units).times(tier.unitAmount) : new Big(0)
  }

  let total = new Big(0)
  let remaining = units
  let previousBound = 0
  for (const { bound, unitAmount } of parsed) {
    if (remaining <= 0) break
    const capacity = bound === null ? null : bound - previousBound
    const unitsInTier =
      capacity === null ? remaining : Math.min(remaining, capacity)
    total = total.plus(new Big(unitsInTier).times(unitAmount))
    remaining -= unitsInTier
    if (bound !== null) previousBound = bound
  }
  return total
}

export const estimateMeteredCost = (
  price:
    | schemas['ProductPriceMeteredUnit']
    | schemas['ProductPriceMeteredTiers'],
  units: number,
): number => {
  if (units <= 0) {
    return 0
  }
  const cost =
    price.amount_type === 'metered_tiers'
      ? tieredCost(price.tiers, units)
      : new Big(units).times(price.unit_amount)

  const rounded = cost.round(0, Big.roundHalfUp).toNumber()
  if (price.cap_amount != null) {
    return Math.min(rounded, price.cap_amount)
  }
  return rounded
}
