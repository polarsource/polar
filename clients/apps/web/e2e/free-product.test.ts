import { PRODUCTS } from './utils/products'
import { describe, expect, test } from './utils/test'

describe('Free product', () => {
  test('gets a free product without entering a card', async ({
    openCheckout,
  }) => {
    const checkout = await openCheckout(PRODUCTS.freeProduct)
    expect((await checkout.state()).is_payment_form_required).toBe(false)
    await checkout.fillEmail()
    const portal = await checkout.submit()

    const [order] = await portal.orders()
    expect(order.product?.name).toBe(PRODUCTS.freeProduct.name)
    expect(order.total_amount).toBe(0)
  })
})
