import { expect, test } from '@playwright/test'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'

test('checkout page loads and shows subscribe button', async ({ page }) => {
  const checkoutLink = process.env.E2E_CHECKOUT_LINK_SUBSCRIPTION

  if (!checkoutLink) {
    test.skip()
    return
  }

  await page.goto(`${API_BASE}/v1/checkout-links/${checkoutLink}/redirect`)

  const button = page.getByRole('button', { name: /subscribe now|pay now/i })
  await expect(button).toBeVisible({ timeout: 15_000 })
})
