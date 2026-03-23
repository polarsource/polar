import { type Locator, type Page, expect } from '@playwright/test'

export class CheckoutPage {
  readonly page: Page
  readonly subscribeButton: Locator
  readonly countrySelect: Locator
  readonly discountCodeInput: Locator

  constructor(page: Page) {
    this.page = page
    this.subscribeButton = page.getByRole('button', {
      name: /subscribe now/i,
    })
    this.countrySelect = page
      .getByRole('combobox')
      .filter({ hasText: 'Country' })
    this.discountCodeInput = page.getByPlaceholder(/discount code/i)
  }

  async goto(checkoutLink: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'
    await this.page.goto(
      `${apiBase}/v1/checkout-links/${checkoutLink}/redirect`,
    )
    await expect(this.subscribeButton).toBeVisible({ timeout: 15_000 })
  }

  async selectCountry(country: string) {
    await this.countrySelect.click()
    await this.page
      .getByRole('option', { name: new RegExp(country, 'i') })
      .click()
  }

  async applyDiscountCode(code: string) {
    await this.page
      .getByRole('button', { name: /this does not exist/i })
      .click()
    await this.discountCodeInput.fill(code)
    await this.page.getByRole('button', { name: /apply/i }).click()
    await expect(this.discountCodeInput).toBeDisabled()
  }

  async subscribe() {
    await this.subscribeButton.click()
  }
}
