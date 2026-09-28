import { PRODUCTS } from './utils/products'
import { describe, expect, test } from './utils/test'

describe('Unit-based subscription', () => {
  test('charges for the chosen number of units', async ({ openCheckout }) => {
    const checkout = await openCheckout(PRODUCTS.unitBasedSubscription)
    const unitAmount =
      PRODUCTS.unitBasedSubscription.prices[0].tiers.tiers[0].unit_amount

    await checkout.setUnits(3)
    expect((await checkout.state()).amount).toBe(3 * unitAmount)

    await checkout.fillEmail()
    await checkout.payWithCard()
    const portal = await checkout.submit()

    const [subscription] = await portal.subscriptions()
    expect(subscription.amount).toBe(3 * unitAmount)
  })
})
