import type { schemas } from '@polar-sh/client'

export interface SeatRow {
  seats: number
  pricePerSeat: number
}

export function getSeatRows(
  checkout: schemas['CheckoutPublic'],
): SeatRow[] | null {
  if (!checkout.product || !checkout.product_price) return null
  const price = checkout.product_price
  if (price.amount_type !== 'seat_based') return null
  const seats = checkout.seats
  if (!seats) return null

  const tiers = [...price.seat_tiers.tiers].sort(
    (a, b) => a.min_seats - b.min_seats,
  )

  if (price.seat_tiers.seat_tier_type === 'graduated') {
    const rows: SeatRow[] = []
    let allocated = 0
    for (const tier of tiers) {
      if (allocated >= seats) break
      const tierEnd = tier.max_seats ?? seats
      const seatsInTier = Math.min(seats, tierEnd) - allocated
      if (seatsInTier > 0) {
        rows.push({ seats: seatsInTier, pricePerSeat: tier.price_per_seat })
      }
      allocated += seatsInTier
    }
    return rows
  }

  const matchingTier = tiers.find(
    (t) =>
      seats >= t.min_seats && (t.max_seats == null || seats <= t.max_seats),
  )
  return [{ seats, pricePerSeat: matchingTier?.price_per_seat ?? 0 }]
}
