import { test, expect } from './fixtures'
import { hasDevDockerInstance } from './support/env'

/**
 * Create a new product from the dashboard (authenticated as the seed admin) and
 * confirm it shows up in the catalogue.
 */
test.describe('Create product', () => {
  test.skip(!hasDevDockerInstance, 'requires the dev-docker stack; run via `dev e2e`')

  test('creates a product and lists it in the catalogue', async ({
    page,
    adminOrgSlug,
  }) => {
    const name = `E2E Product ${Date.now()}`

    await page.goto(`/dashboard/${adminOrgSlug}/products/new`)
    await page.locator('input[name="name"]').fill(name)
    await page.locator('input[name="prices.0.price_amount"]').fill('25')
    await page.getByRole('button', { name: 'Create Product' }).click()

    // Creation navigates away from /new (to the product or the catalogue).
    await page.waitForURL(
      (url) => !url.pathname.endsWith('/products/new'),
      { timeout: 30_000 },
    )

    await page.goto(`/dashboard/${adminOrgSlug}/products`)
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
  })
})
