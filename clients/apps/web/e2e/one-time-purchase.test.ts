import { PRODUCTS } from './utils/products'
import { describe, expect, test } from './utils/test'

describe('One-time purchase', () => {
  test('pays for a fixed-price product', async ({ openCheckout }) => {
    const checkout = await openCheckout(PRODUCTS.oneTimePurchase)
    await checkout.fillEmail()
    await checkout.payWithCard()
    const portal = await checkout.submit()

    const [order] = await portal.orders()
    expect(order.product?.name).toBe(PRODUCTS.oneTimePurchase.name)
    expect(order.paid).toBe(true)
    expect(order.subtotal_amount).toBe(
      PRODUCTS.oneTimePurchase.prices[0].price_amount,
    )
  })
})
