import { type Locator, type Page, expect } from '@playwright/test'

export class CheckoutPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly cardholderNameInput: Locator
  readonly submitButton: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.getByLabel(/email/i)
    this.cardholderNameInput = page.getByLabel(/cardholder name/i)
    this.submitButton = page.getByRole('button', {
      name: /subscribe now|pay now|get for free/i,
    })
  }

  async goto(checkoutLink: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'
    await this.page.goto(
      `${apiBase}/v1/checkout-links/${checkoutLink}/redirect`,
    )
    await expect(this.submitButton).toBeVisible({ timeout: 15_000 })
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email)
  }

  async fillCardholderName(name: string) {
    await this.cardholderNameInput.fill(name)
  }

  async selectCountry(country: string) {
    await this.page.getByText(/country/i).click()
    await this.page
      .getByRole('option', { name: new RegExp(country, 'i') })
      .click()
  }

  async applyDiscountCode(code: string) {
    await this.page.getByRole('button', { name: /add discount code/i }).click()
    await this.page.getByPlaceholder(/discount code/i).fill(code)
    await this.page.getByRole('button', { name: /apply/i }).click()
    await expect(this.page.getByPlaceholder(/discount code/i)).toBeDisabled()
  }

  async submit() {
    await this.submitButton.click()
  }

  async expectConfirmation() {
    await expect(this.page.getByText(/your order was successful/i)).toBeVisible(
      { timeout: 30_000 },
    )
  }
}
