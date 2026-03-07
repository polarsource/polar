import { test } from '@playwright/test'
import { CheckoutPage } from './pages/checkout.page'

test.describe('Checkout', () => {
  const checkoutLink = process.env.E2E_CHECKOUT_LINK_SUBSCRIPTION ?? ''

  test('Subscription with discount', async ({ page }) => {
    // if (!checkoutLink) {
    //   test.skip()
    //   return
    // }

    const checkout = new CheckoutPage(page)
    await checkout.goto(checkoutLink)
    await checkout.selectCountry('Sweden')
    await checkout.applyDiscountCode('Free')
    await checkout.subscribe()
  })

  test('Subscription without a discount', async ({ page }) => {
    // if (!checkoutLink) {
    //   test.skip()
    //   return
    // }

    const checkout = new CheckoutPage(page)
    await checkout.goto(checkoutLink)
    await checkout.selectCountry('Sweden')
    await checkout.applyDiscountCode('Free')
    await checkout.subscribe()
  })
})
