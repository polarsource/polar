import { PRODUCTS } from './utils/products'
import { describe, expect, test } from './utils/test'

describe('Product switcher', () => {
  test('pays for the product picked in the checkout', async ({
    openCheckout,
  }) => {
    const checkout = await openCheckout([
      PRODUCTS.oneTimePurchase,
      PRODUCTS.bundlePurchase,
    ])
    expect((await checkout.state()).product?.name).toBe(
      PRODUCTS.oneTimePurchase.name,
    )

    await checkout.chooseProduct(PRODUCTS.bundlePurchase.name)
    expect((await checkout.state()).amount).toBe(
      PRODUCTS.bundlePurchase.prices[0].price_amount,
    )

    await checkout.fillEmail()
    await checkout.payWithCard()
    const portal = await checkout.submit()

    const [order] = await portal.orders()
    expect(order.product?.name).toBe(PRODUCTS.bundlePurchase.name)
  })
})
