import { PRODUCTS } from './utils/products'
import { describe, expect, test } from './utils/test'

describe('Trial subscription', () => {
  test('starts a trial and cancels it at the end of the trial', async ({
    openCheckout,
  }) => {
    const checkout = await openCheckout(PRODUCTS.trialSubscription)
    expect((await checkout.state()).trial_end).toBeTruthy()
    await checkout.fillEmail()
    await checkout.payWithCard()
    const portal = await checkout.submit()

    await expect
      .poll(async () => (await portal.subscriptions()).map((s) => s.status), {
        message: 'subscription statuses',
      })
      .toContain('trialing')
    await portal.cancelSubscriptions()
    await expect
      .poll(
        async () =>
          (await portal.subscriptions()).map((s) => s.cancel_at_period_end),
        { message: 'subscriptions cancelled at the end of the trial' },
      )
      .not.toContain(false)
  })
})
