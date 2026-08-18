import { schemas } from '@polar-sh/client'
import { FreeProductPriceCreate, ProductFormType } from '../ProductForm'

export type ProductPrice = schemas['ProductPrice']
// Includes the UI-only `free` price type (converted to a fixed price of 0 on submit).
export type ProductPriceCreate =
  | schemas['ProductCreate']['prices'][number]
  | FreeProductPriceCreate
export type AnyPrice = NonNullable<ProductFormType['prices']>[number]
export type PriceEntry = { price: AnyPrice; index: number }

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

type MeteredTiers = NonNullable<schemas['ProductPriceMeteredUnit']['tiers']>

const parseTiers = (tiers: MeteredTiers['tiers']) =>
  tiers
    .map((tier) => ({
      upTo: tier.bound,
      pricePerUnit: Number.parseFloat(String(tier.unit_amount)),
    }))
    .sort(
      (a, b) =>
        Number(a.upTo === null) - Number(b.upTo === null) ||
        (a.upTo ?? 0) - (b.upTo ?? 0),
    )

const tieredCost = (
  { type: tierType, tiers }: MeteredTiers,
  units: number,
): number => {
  const parsed = parseTiers(tiers)

  if (tierType === 'volume') {
    // A bounded last tier can't be created through the API, but if usage ever
    // lands past every bound, the top rate is a better estimate than nothing.
    const tier =
      parsed.find((t) => t.upTo === null || units <= t.upTo) ??
      parsed[parsed.length - 1]
    return tier ? units * tier.pricePerUnit : 0
  }

  let total = 0
  let remaining = units
  let previousUpTo = 0
  for (const { upTo, pricePerUnit } of parsed) {
    if (remaining <= 0) break
    const capacity = upTo === null ? null : upTo - previousUpTo
    const unitsInTier =
      capacity === null ? remaining : Math.min(remaining, capacity)
    total += unitsInTier * pricePerUnit
    remaining -= unitsInTier
    if (upTo !== null) previousUpTo = upTo
  }
  return total
}

export const estimateMeteredCost = (
  price: schemas['ProductPriceMeteredUnit'],
  units: number,
): number => {
  if (units <= 0) {
    return 0
  }
  const cost = price.tiers
    ? tieredCost(price.tiers, units)
    : units * Number.parseFloat(price.unit_amount ?? '0')
  if (price.cap_amount != null) {
    return Math.min(cost, price.cap_amount)
  }
  return cost
}
