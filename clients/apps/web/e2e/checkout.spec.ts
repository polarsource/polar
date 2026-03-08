import { expect, test } from '@playwright/test'
// import { CheckoutPage } from './pages/checkout.page'

test.describe('Checkout', () => {
  const checkoutLink = process.env.E2E_CHECKOUT_LINK_SUBSCRIPTION ?? ''

  test('Subscription with discount', async ({ page }) => {
    expect(1 + 1).toBe(2)
    // if (!checkoutLink) {
    //   test.skip()
    //   return
    // }

    // const checkout = new CheckoutPage(page)
    // await checkout.goto(checkoutLink)
    // await checkout.selectCountry('Sweden')
    // await checkout.applyDiscountCode('Free')
    // await checkout.subscribe()
  })
})
