import { expect, test } from '@playwright/test'
import { CheckoutPage } from './pages/checkout.page'

test.describe('Checkout', () => {
  const checkoutLink = process.env.E2E_CHECKOUT_LINK_SUBSCRIPTION ?? ''

  test('Subscription purchase', async ({ page }) => {
    if (!checkoutLink) {
      console.log('Skipping: E2E_CHECKOUT_LINK_SUBSCRIPTION is not set')
      test.skip()
      return
    }

    const email = `e2e-test+${Date.now()}@polar.sh`
    const checkout = new CheckoutPage(page)
    await checkout.goto(checkoutLink)
    await checkout.fillEmail(email)
    await checkout.selectCountry('Sweden')
    await checkout.fillStripeCard()
    await checkout.fillCardholderName('E2E Test')

    await expect(checkout.submitButton).toHaveText(/subscribe now/i)
    await checkout.submit()
    await checkout.expectConfirmation()
  })
})
