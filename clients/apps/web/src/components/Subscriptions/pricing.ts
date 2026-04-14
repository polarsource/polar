import { schemas } from '@polar-sh/client'

export function getPendingTotalAmount(
  product: schemas['Product'],
  currency: string,
  seats: number,
): number | null {
  const price = product.prices.find((p) => p.price_currency === currency)
  if (!price) return null

  if (price.amount_type === 'fixed') {
    return price.price_amount
  }

  if (price.amount_type === 'seat_based') {
    const tiers = price.seat_tiers.tiers
    let total = 0
    let remaining = seats
    for (const tier of tiers) {
      const tierCapacity =
        tier.max_seats != null ? tier.max_seats - tier.min_seats + 1 : remaining
      const seatsInTier = Math.min(remaining, tierCapacity)
      total += seatsInTier * tier.price_per_seat
      remaining -= seatsInTier
      if (remaining <= 0) break
    }
    return total
  }

  return null
}

export const getCustomerSubscriptionBasePrice = (
  subscription: schemas['CustomerSubscription'],
): { amount: number; currency: string } | null => {
  const price = subscription.product.prices.find(
    ({ amount_type, price_currency }) =>
      (amount_type === 'fixed' || amount_type === 'custom') &&
      price_currency === subscription.currency,
  )

  if (!price) {
    return null
  }

  // This should be obsolete but I don't think we have proper type guards for the generated schema
  if ('price_amount' in price) {
    return {
      amount: price.price_amount,
      currency: price.price_currency,
    }
  }

  return null
}
