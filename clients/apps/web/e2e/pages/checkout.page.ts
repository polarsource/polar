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
    const url = `${apiBase}/v1/checkout-links/${checkoutLink}/redirect`

    // Preview envs can take a while to boot, we poll until
    // the redirect target stops returning 404, up to 120s.
    const deadline = Date.now() + 120_000
    while (true) {
      const response = await this.page.goto(url)
      if (response && response.status() !== 404) break
      if (Date.now() >= deadline) {
        throw new Error(`Preview env still returning 404 after 120s: ${url}`)
      }
      await this.page.waitForTimeout(5_000)
    }

    await expect(this.submitButton).toBeVisible({ timeout: 15_000 })
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email)
  }

  async fillCardholderName(name: string) {
    await this.cardholderNameInput.waitFor({
      state: 'visible',
      timeout: 10_000,
    })
    // Click first to move focus out of the Stripe iframe (away from Link)
    await this.cardholderNameInput.click()
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

  async fillStripeCard({
    number = '4242424242424242',
    expiry = '12/30',
    cvc = '123',
  } = {}) {
    const stripeFrame = this.page
      .frameLocator('iframe[title="Secure payment input frame"]')
      .first()

    const cardInput = stripeFrame.getByPlaceholder('1234 1234 1234 1234')
    await cardInput.waitFor({ state: 'visible', timeout: 15_000 })
    await cardInput.fill(number)
    await stripeFrame.getByPlaceholder('MM / YY').fill(expiry)
    await stripeFrame.getByPlaceholder('CVC').fill(cvc)

    // Wait for Stripe Link to settle before moving focus away
    await this.page.waitForTimeout(1000)
  }

  async submit() {
    await this.submitButton.click()
  }

  async expectConfirmation() {
    await expect(
      this.page.getByText(/your order was successful/i),
    ).toBeVisible()
  }

  async expectProcessing() {
    await expect(
      this.page.getByText(/we are processing your order/i),
    ).toBeVisible()
  }
}
