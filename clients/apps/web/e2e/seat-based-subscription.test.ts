import { PRODUCTS } from './utils/products'
import { describe, expect, test } from './utils/test'

const PRICE_PER_SEAT =
  PRODUCTS.seatBasedSubscription.prices[0].seat_tiers.tiers[0].price_per_seat

describe('Seat-based subscription', () => {
  test('changes the seat count before subscribing', async ({
    openCheckout,
  }) => {
    const checkout = await openCheckout(PRODUCTS.seatBasedSubscription)

    await checkout.setSeats(3)
    expect((await checkout.state()).amount).toBe(3 * PRICE_PER_SEAT)
    await checkout.setSeats(2)
    expect((await checkout.state()).amount).toBe(2 * PRICE_PER_SEAT)

    await checkout.fillEmail()
    await checkout.payWithCard()
    const portal = await checkout.submit()

    await expect
      .poll(async () => (await portal.subscriptions()).map((s) => s.seats), {
        message: 'subscription seats',
      })
      .toContain(2)
  })
})
