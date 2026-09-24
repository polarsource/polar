import { CARD, DECLINED_CARD } from './utils/constants'
import { PRODUCTS } from './utils/products'
import { describe, expect, test } from './utils/test'

describe('Declined card', () => {
  test('shows the decline and accepts another card', async ({
    openCheckout,
  }) => {
    const checkout = await openCheckout(PRODUCTS.oneTimePurchase)
    await checkout.fillEmail()
    await checkout.payWithCard(DECLINED_CARD)

    await checkout.submitExpectingError('Your card has been declined')
    await checkout.awaitStatus('open')

    await checkout.payWithCard(CARD)
    const portal = await checkout.submit()

    const orders = await portal.orders()
    expect(orders).toHaveLength(1)
    expect(orders[0].paid).toBe(true)
  })
})
