import { PRODUCTS } from './utils/products'
import { describe, expect, test } from './utils/test'

const AMOUNT = 1500

describe('Pay what you want', () => {
  test('pays a chosen amount above the minimum', async ({ openCheckout }) => {
    const checkout = await openCheckout(PRODUCTS.payWhatYouWant)
    await checkout.setAmount(AMOUNT)
    await checkout.fillEmail()
    await checkout.payWithCard()
    const portal = await checkout.submit()

    const [order] = await portal.orders()
    expect(order.product?.name).toBe(PRODUCTS.payWhatYouWant.name)
    expect(order.paid).toBe(true)
    expect(order.subtotal_amount).toBe(AMOUNT)
  })
})
