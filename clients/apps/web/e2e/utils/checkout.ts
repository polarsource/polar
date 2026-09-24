import type { schemas } from '@polar-sh/client'
import type { Frame } from 'playwright'
import { expect } from 'vitest'
import type { App } from './app'
import { BILLING_ADDRESS, CARD, WEBHOOK_TIMEOUT } from './constants'
import { orgApi } from './api'
import { ensureProduct } from './org'
import type { ProductSpec } from './products'

type Checkout = schemas['CheckoutPublic']
type Card = typeof CARD
export type Subscription = schemas['CustomerSubscription']
export type Order = schemas['CustomerOrder']

export const openCheckout = async (
  app: App,
  specs: ProductSpec | ProductSpec[],
): Promise<CheckoutPage> => {
  const products = await Promise.all(
    [specs].flat().map((spec) => ensureProduct(spec)),
  )
  const body: Pick<schemas['CheckoutProductsCreate'], 'products'> = {
    products,
  }
  const { url, client_secret } = await orgApi<schemas['Checkout']>(
    '/v1/checkouts/',
    { method: 'POST', body },
  )
  app.meta.checkoutUrl = url
  await app.goto(url)
  return new CheckoutPage(app, client_secret)
}

export class CheckoutPage {
  constructor(
    private readonly app: App,
    readonly clientSecret: string,
  ) {}

  state = (): Promise<Checkout> =>
    this.app.api<Checkout>(`/v1/checkouts/client/${this.clientSecret}`)

  hasMessage = (text: string): Promise<boolean> =>
    this.app.page.getByText(text).isVisible()

  awaitStatus = (status: Checkout['status']): Promise<void> =>
    expect
      .poll(async () => (await this.state()).status, {
        timeout: WEBHOOK_TIMEOUT,
        message: 'checkout status',
      })
      .toBe(status)

  private address = async () => (await this.state()).customer_billing_address

  private input = (autocomplete: string) =>
    this.app.page.locator(`input[autocomplete="${autocomplete}"]`)

  private submitButton = () =>
    this.app.page.locator('form button[type="submit"]')

  async fillEmail(email = `e2e+${Date.now()}@polar.sh`): Promise<string> {
    await this.app.fill(
      this.app.page.getByRole('textbox', { name: 'Email' }),
      email,
      async () => (await this.state()).customer_email === email,
    )
    return email
  }

  async enterRejectedAmount(cents: number, reason: string): Promise<void> {
    await this.app.fill(
      this.app.page.locator('input[name="amount"]'),
      String(cents / 100),
      () => this.hasMessage(reason),
    )
  }

  async setAmount(cents: number): Promise<void> {
    await this.app.fill(
      this.app.page.locator('input[name="amount"]'),
      String(cents / 100),
      async () => (await this.state()).amount === cents,
    )
  }

  setSeats = (seats: number): Promise<void> => this.count('seats', seats)

  setUnits = (units: number): Promise<void> => this.count('units', units)

  private async count(key: 'seats' | 'units', target: number): Promise<void> {
    const button = (direction: string) =>
      this.app.page.getByRole('button', { name: `${direction} ${key}` })
    let current = (await this.state())[key] ?? 1
    while (current !== target) {
      const next = current + Math.sign(target - current)
      await this.app.click(
        button(next > current ? 'Increase' : 'Decrease'),
        async () => (await this.state())[key] === next,
      )
      current = next
    }
  }

  async applyDiscount(code: string): Promise<void> {
    const input = this.app.page.getByPlaceholder('Discount code')
    await this.app.click(
      this.app.page.getByRole('button', { name: 'Add discount code' }),
      () => input.isVisible(),
    )
    await this.app.fill(
      input,
      code,
      async () => (await this.state()).discount?.code === code,
      () => this.apply(),
    )
  }

  private apply = (): Promise<void> =>
    this.app.page.getByRole('button', { name: 'Apply' }).click()

  async chooseProduct(name: string): Promise<void> {
    await this.app.click(
      this.app.page.getByRole('radio', { name }),
      async () => (await this.state()).product?.name === name,
    )
  }

  async fillCustomField(label: string, value: string): Promise<void> {
    const slug = (await this.state()).attached_custom_fields?.find(
      (attached) => attached.custom_field?.name === label,
    )?.custom_field?.slug
    expect(slug, `custom field "${label}" attached to the product`).toBeTruthy()
    const input = this.app.page.locator(
      `input[name="custom_field_data.${slug}"]`,
    )
    await this.app.fill(
      input,
      value,
      async () => (await input.inputValue()) === value,
    )
  }

  async purchaseAsBusiness(business: {
    name: string
    taxId: string
  }): Promise<void> {
    await this.app.click(
      this.app.page.getByRole('checkbox', {
        name: "I'm purchasing as a business",
      }),
      async () => (await this.state()).is_business_customer,
    )
    const name = this.app.page.getByTestId('business-name')
    await this.app.fill(
      name,
      business.name,
      async () => (await name.inputValue()) === business.name,
    )
    await this.app.fill(
      this.app.page.getByTestId('tax-id'),
      business.taxId,
      async () => (await this.state()).customer_tax_id !== null,
      () => this.apply(),
    )
  }

  async payWithCard(card: Card = CARD, name = 'E2E Tester'): Promise<void> {
    await this.app.fill(
      this.app.page.getByRole('textbox', { name: 'Cardholder name' }),
      name,
      async () => (await this.state()).customer_name === name,
    )
    await this.fillBillingAddress()
    await this.app.type(this.app.stripeField('number'), card.number)
    await this.app.type(this.app.stripeField('expiry'), card.expiry)
    await this.app.type(this.app.stripeField('cvc'), card.cvc)
  }

  private async fillBillingAddress(): Promise<void> {
    const { country, line1, postalCode, city, state } = BILLING_ADDRESS
    if ((await this.address())?.country !== country) {
      const countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(
        country,
      )
      await this.app.select(
        this.app.page.getByTestId('billing-country'),
        countryName!,
        async () => (await this.address())?.country === country,
      )
    }
    await this.app.fill(
      this.input('billing address-line1'),
      line1,
      async () => (await this.address())?.line1 === line1,
    )
    await this.app.fill(
      this.input('billing postal-code'),
      postalCode,
      async () => (await this.address())?.postal_code === postalCode,
    )
    await this.app.fill(
      this.input('billing address-level2'),
      city,
      async () => (await this.address())?.city === city,
    )
    await this.app.select(
      this.app.page.getByTestId('billing-state'),
      state.name,
      async () => (await this.address())?.state === `${country}-${state.code}`,
    )
  }

  async submit(): Promise<Portal> {
    await this.app.click(
      this.submitButton(),
      async () => (await this.state()).status !== 'open',
    )
    return this.confirmation()
  }

  async submitExpectingError(message: string): Promise<void> {
    await this.submitButton().click()
    await expect
      .poll(() => this.hasMessage(message), { message: `"${message}" shown` })
      .toBe(true)
    await this.app.snap('rejected')
  }

  async submitFor3ds(): Promise<ThreeDSecure> {
    const challenge = new ThreeDSecure(this.app)
    await this.app.click(this.submitButton(), () => challenge.isOpen())
    return challenge
  }

  async confirmation(): Promise<Portal> {
    await expect
      .poll(() => this.app.url(), { message: 'confirmation page' })
      .toContain('/confirmation')
    const token = new URL(await this.app.url()).searchParams.get(
      'customer_session_token',
    )
    expect(token, 'customer session token in the confirmation URL').toBeTruthy()
    const portal = new Portal(this.app, token!)
    this.app.onCleanup(() => portal.cancelSubscriptions())
    await this.awaitStatus('succeeded')
    return portal
  }
}

export class ThreeDSecure {
  constructor(private readonly app: App) {}

  private testPage = () =>
    this.app.frame(/^https:\/\/testmode-acs\.stripe\.com\//)

  isOpen = async (): Promise<boolean> =>
    (await this.testPage()
      ?.getByRole('button', { name: 'Complete' })
      .isVisible()) ?? false

  complete = (): Promise<void> => this.press(this.testPage(), 'Complete')

  cancel = (): Promise<void> =>
    this.press(this.app.frame(/three-ds-2-challenge/), 'Cancel')

  private async press(frame: Frame | undefined, name: string): Promise<void> {
    expect(frame, '3D Secure challenge').toBeDefined()
    await this.app.click(
      frame!.getByRole('button', { name }),
      async () => !(await this.isOpen()),
    )
  }
}

export class Portal {
  constructor(
    private readonly app: App,
    private readonly token: string,
  ) {}

  private list = async <T>(path: string): Promise<T[]> =>
    (await this.app.api<{ items: T[] }>(path, { token: this.token })).items

  subscriptions = (): Promise<Subscription[]> =>
    this.list<Subscription>('/v1/customer-portal/subscriptions/')

  orders = (): Promise<Order[]> =>
    this.list<Order>('/v1/customer-portal/orders/')

  async cancelSubscriptions(): Promise<void> {
    const live = (await this.subscriptions()).filter(
      (subscription) =>
        !subscription.ended_at && !subscription.cancel_at_period_end,
    )
    for (const { id } of live) {
      await this.app.api(`/v1/customer-portal/subscriptions/${id}`, {
        method: 'DELETE',
        token: this.token,
      })
    }
  }
}
