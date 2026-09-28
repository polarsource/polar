import { PRODUCTS } from './utils/products'
import { describe, expect, test } from './utils/test'

const HALF_OFF = {
  name: 'E2E half off',
  code: 'E2EHALF',
  type: 'percentage',
  basis_points: 5000,
  duration: 'once',
} as const

describe('Discount code', () => {
  test('halves the price and the order total', async ({
    openCheckout,
    org,
  }) => {
    await org.discount(HALF_OFF)
    const price = PRODUCTS.oneTimePurchase.prices[0].price_amount

    const checkout = await openCheckout(PRODUCTS.oneTimePurchase)
    await checkout.applyDiscount(HALF_OFF.code)
    const state = await checkout.state()
    expect(state.discount_amount).toBe(price / 2)
    expect(state.net_amount).toBe(price / 2)

    await checkout.fillEmail()
    await checkout.payWithCard()
    const portal = await checkout.submit()

    const [order] = await portal.orders()
    expect(order.discount_amount).toBe(price / 2)
    expect(order.subtotal_amount).toBe(price)
  })
})
