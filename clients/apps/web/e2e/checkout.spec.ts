import { expect, test } from '@playwright/test'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'

test('TEMP: force failure to test Slack notification', async () => {
  expect(true).toBe(false)
})

test('checkout subscription with discount', async ({ page }) => {
  const checkoutLink = process.env.E2E_CHECKOUT_LINK_SUBSCRIPTION

  if (!checkoutLink) {
    test.skip()
    return
  }

  await page.goto(`${API_BASE}/v1/checkout-links/${checkoutLink}/redirect`)

  const subscribeButton = page.getByRole('button', {
    name: /subscribe now/i,
  })
  await expect(subscribeButton).toBeVisible({ timeout: 15_000 })

  const countrySelect = page
    .getByRole('combobox')
    .filter({ hasText: 'Country' })
  await countrySelect.click()
  await page.getByRole('option', { name: /sweden/i }).click()

  await page.getByRole('button', { name: /add discount code/i }).click()
  await page.getByPlaceholder(/discount code/i).fill('Free')
  await page.getByRole('button', { name: /apply/i }).click()

  await expect(page.getByPlaceholder(/discount code/i)).toBeDisabled()

  await subscribeButton.click()
})
