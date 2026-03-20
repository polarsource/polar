import { expect, test } from '@playwright/test'
import { CheckoutPage } from './pages/checkout.page'

test.describe('Checkout', () => {
  const checkoutLink = process.env.E2E_CHECKOUT_LINK_SUBSCRIPTION ?? ''
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'

  test('Subscription with discount', async ({ page }) => {
    if (!checkoutLink) {
      console.log('Skipping: E2E_CHECKOUT_LINK_SUBSCRIPTION is not set')
      test.skip()
      return
    }

    const checkout = new CheckoutPage(page)
    await checkout.goto(checkoutLink)
    await checkout.fillEmail('e2e-test@example.com')
    await checkout.selectCountry('Sweden')
    await checkout.applyDiscountCode('free')

    await expect(checkout.submitButton).toHaveText(/get for free/i)
    await checkout.submit()
    await checkout.expectConfirmation()
  })
})
