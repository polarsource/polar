import { test, expect } from './fixtures'
import { registerWithEmail, completeOnboarding } from './support/signup'
import { hasDevDockerInstance } from './support/env'

/**
 * Full sign up: brand-new email → email OTP → onboarding → org dashboard.
 * Runs unauthenticated (overrides the shared admin storageState).
 */
test.describe('Sign up', () => {
  test.skip(!hasDevDockerInstance, 'requires the dev-docker stack; run via `dev e2e`')
  test.use({ storageState: { cookies: [], origins: [] } })

  test('registers with email OTP and reaches the dashboard', async ({ page }) => {
    test.setTimeout(120_000)
    const stamp = Date.now()
    const email = `petru+e2e-signup-${stamp}@polar.sh`
    const orgName = `E2E Org ${stamp}`

    await registerWithEmail(page, email)
    const slug = await completeOnboarding(page, { orgName })

    await expect(page).toHaveURL(new RegExp(`/dashboard/${slug}`))
    await expect(
      page.getByRole('link', { name: 'Products', exact: true }).first(),
    ).toBeVisible()
  })
})
