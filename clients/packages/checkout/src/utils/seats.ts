import type { schemas } from '@polar-sh/client'
import { getSeatPrice } from '../guards'
import { sortTiers } from './units'

export interface SeatRow {
  seats: number
  pricePerSeat: number
  min: number
  max: number | null
}

export function getSeatRows(
  checkout: schemas['CheckoutPublic'],
): SeatRow[] | null {
  const price = getSeatPrice(checkout)
  if (!price) return null
  const seats = checkout.seats
  if (!seats) return null

  const tiers = sortTiers(price.tiers.tiers).map((tier, index, sorted) => ({
    min_seats: index === 0 ? 1 : (sorted[index - 1].bound ?? 0) + 1,
    max_seats: tier.bound ?? null,
    price_per_seat: Number(tier.unit_amount),
  }))

  if (price.tiers.type === 'graduated') {
    const rows: SeatRow[] = []
    let allocated = 0
    for (const tier of tiers) {
      if (allocated >= seats) break
      const tierEnd = tier.max_seats ?? seats
      const seatsInTier = Math.min(seats, tierEnd) - allocated
      if (seatsInTier > 0) {
        rows.push({
          seats: seatsInTier,
          pricePerSeat: tier.price_per_seat,
          min: tier.min_seats,
          max: tier.max_seats ?? null,
        })
      }
      allocated += seatsInTier
    }
    return rows
  }

  const matchingTier = tiers.find(
    (t) =>
      seats >= t.min_seats && (t.max_seats == null || seats <= t.max_seats),
  )
  return [
    {
      seats,
      pricePerSeat: matchingTier?.price_per_seat ?? 0,
      min: matchingTier?.min_seats ?? 1,
      max: matchingTier?.max_seats ?? null,
    },
  ]
}
