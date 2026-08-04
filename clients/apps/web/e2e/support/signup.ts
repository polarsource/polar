import type { Page } from '@playwright/test'
import { requestEmailOtp } from './auth'

/** Opens a Radix Select showing `current` and picks the `option`. */
async function selectOption(page: Page, current: string, option: string | RegExp) {
  await page.getByRole('combobox').filter({ hasText: current }).first().click()
  await page.getByRole('option', { name: option }).first().click()
}

/**
 * Registers a brand-new account via the email-OTP flow and leaves `page` on the
 * post-signup onboarding (`/onboarding/start`).
 */
export async function registerWithEmail(page: Page, email: string): Promise<void> {
  await requestEmailOtp(page, email)
  await page.waitForURL(/\/onboarding\/start/, { timeout: 30_000 })
}

/**
 * Drives the "business" onboarding wizard (personal → business → product) until
 * it lands on the new org's dashboard. Returns the created org slug.
 */
export async function completeOnboarding(
  page: Page,
  { orgName }: { orgName: string },
): Promise<string> {
  await page.getByRole('button', { name: /get started/i }).click()
  await page.waitForURL(/\/onboarding\/personal/, { timeout: 30_000 })

  // Personal
  await page.getByPlaceholder('Jane').fill('E2E')
  await page.getByPlaceholder('Doe').fill('Tester')
  await selectOption(page, 'Select country', 'United States')
  await selectOption(page, 'Month', /January/i)
  await selectOption(page, 'Day', /^1$/)
  await selectOption(page, 'Year', /^1990$/)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Business (Individual is the default type; currency defaults to USD)
  await page.waitForURL(/\/onboarding\/business/, { timeout: 30_000 })
  await page.getByPlaceholder('Acme Inc.').fill(orgName)
  await page.getByRole('button', { name: 'Continue' }).click()

  // Product
  await page.waitForURL(/\/onboarding\/product/, { timeout: 30_000 })
  await page.getByRole('button', { name: 'Software / SaaS' }).click()
  await page
    .getByPlaceholder("Tell us about what you're selling...")
    .fill('An E2E test product for automated verification of onboarding.')
  await page.getByRole('button', { name: 'One-time purchase' }).click()
  await page.getByRole('button', { name: 'Launch Dashboard' }).click()

  await page.waitForURL(/\/dashboard\/[^/]+/, { timeout: 60_000 })
  const match = page.url().match(/\/dashboard\/([^/?]+)/)
  return match![1]
}
