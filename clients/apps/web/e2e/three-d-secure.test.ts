import { CARD, THREE_D_SECURE_CARD } from './utils/constants'
import { PRODUCTS } from './utils/products'
import { describe, expect, test } from './utils/test'

describe('3D Secure', () => {
  test('completes the challenge and pays', async ({ openCheckout }) => {
    const checkout = await openCheckout(PRODUCTS.oneTimePurchase)
    await checkout.fillEmail()
    await checkout.payWithCard(THREE_D_SECURE_CARD)

    const challenge = await checkout.submitFor3ds()
    await challenge.complete()
    const portal = await checkout.confirmation()

    const [order] = await portal.orders()
    expect(order.paid).toBe(true)
  })

  test('recovers when the buyer cancels the challenge', async ({
    openCheckout,
  }) => {
    const checkout = await openCheckout(PRODUCTS.oneTimePurchase)
    await checkout.fillEmail()
    await checkout.payWithCard(THREE_D_SECURE_CARD)

    const challenge = await checkout.submitFor3ds()
    await challenge.cancel()
    await expect
      .poll(() => checkout.hasMessage('unable to authenticate'))
      .toBe(true)
    await checkout.awaitStatus('open')

    await checkout.payWithCard(CARD)
    const portal = await checkout.submit()

    const orders = await portal.orders()
    expect(orders).toHaveLength(1)
    expect(orders[0].paid).toBe(true)
  })
})
