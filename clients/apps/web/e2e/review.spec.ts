import { expect, test } from '@playwright/test'

/**
 * Merchant Account Review case page (Slice 4).
 *
 * Authenticates by injecting a maintainer session cookie (the seed
 * script prints one) and loads /dashboard/<org>/review, asserting the
 * dedicated review surface renders for the org owner.
 *
 * Requires, in env:
 *   E2E_SESSION_COOKIE  - value of the polar_session cookie
 *   E2E_ORG_SLUG        - slug of an org the session's user belongs to
 * and the API (:8000) + web (:3000) servers running. Skips cleanly if
 * the cookie isn't provided so CI without the fixture stays green.
 */
test.describe('Merchant Account Review', () => {
  const sessionCookie = process.env.E2E_SESSION_COOKIE ?? ''
  const orgSlug = process.env.E2E_ORG_SLUG ?? 'e2e-merchant'

  test('renders the review case page for the org owner', async ({
    page,
    context,
  }) => {
    test.skip(!sessionCookie, 'E2E_SESSION_COOKIE not provided')

    await context.addCookies([
      {
        name: 'polar_session',
        value: sessionCookie,
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    const response = await page.goto(`/dashboard/${orgSlug}/review`, {
      waitUntil: 'networkidle',
    })
    expect(response?.status()).toBeLessThan(400)

    // The dedicated review surface renders (server component →
    // ReviewPage with the data-testid wrapper).
    await expect(page.getByTestId('review-page')).toBeVisible()
    await expect(
      page.getByText('Account Review', { exact: false }).first(),
    ).toBeVisible()

    // The AIValidationResult component renders one of its known
    // states (loading / approved / denied / under review). Assert the
    // policy-review copy is present.
    await expect(
      page
        .getByText(/acceptable use policy|reviewing|approved|review/i)
        .first(),
    ).toBeVisible()

    if (process.env.E2E_SCREENSHOT_PATH) {
      await page.screenshot({
        path: process.env.E2E_SCREENSHOT_PATH,
        fullPage: true,
      })
    }
  })
})
