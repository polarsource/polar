import type { schemas } from '@polar-sh/client'
import { createHash } from 'node:crypto'
import { expect } from 'vitest'
import type { App } from './app'
import { BILLING_ADDRESS, CARD, ORG_TOKEN } from './constants'
import type { ProductSpec } from './products'

type Checkout = schemas['CheckoutPublic']
export type Subscription = schemas['CustomerSubscription']
export type Order = schemas['CustomerOrder']

const orgApi = <T>(
  app: App,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> => {
  if (!ORG_TOKEN) {
    throw new Error('E2E_ORG_TOKEN is not set: run `dev e2e setup`')
  }
  return app.api<T>(path, { ...init, token: ORG_TOKEN })
}

const specHash = (spec: ProductSpec) =>
  createHash('sha256').update(JSON.stringify(spec)).digest('hex').slice(0, 12)

const ensureProduct = async (app: App, spec: ProductSpec): Promise<string> => {
  const hash = specHash(spec)
  const { items } = await orgApi<schemas['ListResource_Product_']>(
    app,
    `/v1/products/?query=${encodeURIComponent(spec.name)}&is_archived=false&limit=100`,
  )
  const sameName = items.filter((product) => product.name === spec.name)
  const current = sameName.find((product) => product.metadata.e2e_spec === hash)
  for (const stale of sameName.filter((product) => product !== current)) {
    await orgApi(app, `/v1/products/${stale.id}`, {
      method: 'PATCH',
      body: { is_archived: true },
    })
  }
  if (current) return current.id
  const created = await orgApi<schemas['Product']>(app, '/v1/products/', {
    method: 'POST',
    body: { ...spec, metadata: { e2e_spec: hash } },
  })
  return created.id
}

export const openCheckout = async (
  app: App,
  spec: ProductSpec,
): Promise<CheckoutPage> => {
  const productId = await ensureProduct(app, spec)
  const body: Pick<schemas['CheckoutProductsCreate'], 'products'> = {
    products: [productId],
  }
  const { url, client_secret } = await orgApi<schemas['Checkout']>(
    app,
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

  private address = async () => (await this.state()).customer_billing_address

  private input = (autocomplete: string) =>
    this.app.page.locator(`input[autocomplete="${autocomplete}"]`)

  private dropdown = (autocomplete: string) =>
    this.app.page
      .locator(`select[autocomplete="${autocomplete}"]`)
      .locator('xpath=preceding-sibling::button[@role="combobox"][1]')

  async fillEmail(email = `e2e+${Date.now()}@polar.sh`): Promise<string> {
    await this.app.fill(
      this.app.page.getByRole('textbox', { name: 'Email' }),
      email,
      async () => (await this.state()).customer_email === email,
    )
    return email
  }

  async setAmount(cents: number): Promise<void> {
    await this.app.fill(
      this.app.page.locator('input[name="amount"]'),
      String(cents / 100),
      async () => (await this.state()).amount === cents,
    )
  }

  async setSeats(seats: number): Promise<void> {
    const increase = this.app.page.getByRole('button', {
      name: 'Increase seats',
    })
    const decrease = this.app.page.getByRole('button', {
      name: 'Decrease seats',
    })
    let current = (await this.state()).seats ?? 1
    while (current !== seats) {
      const next = current + Math.sign(seats - current)
      await this.app.click(
        next > current ? increase : decrease,
        async () => (await this.state()).seats === next,
      )
      current = next
    }
  }

  async payWithCard(name = 'E2E Tester'): Promise<void> {
    await this.app.fill(
      this.app.page.getByRole('textbox', { name: 'Cardholder name' }),
      name,
      async () => (await this.state()).customer_name === name,
    )
    await this.fillBillingAddress()
    await this.app.type(this.app.stripeField('number'), CARD.number)
    await this.app.type(this.app.stripeField('expiry'), CARD.expiry)
    await this.app.type(this.app.stripeField('cvc'), CARD.cvc)
  }

  private async fillBillingAddress(): Promise<void> {
    const { country, line1, postalCode, city, state } = BILLING_ADDRESS
    if ((await this.address())?.country !== country) {
      const countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(
        country,
      )
      await this.app.select(
        this.dropdown('billing country'),
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
      this.dropdown('billing address-level1'),
      state.name,
      async () => (await this.address())?.state === `${country}-${state.code}`,
    )
  }

  async submit(): Promise<Portal> {
    await this.app.click(
      this.app.page.locator('form button[type="submit"]'),
      async () => (await this.state()).status !== 'open',
    )
    await expect
      .poll(() => this.app.url(), { message: 'confirmation page' })
      .toContain('/confirmation')
    const token = new URL(await this.app.url()).searchParams.get(
      'customer_session_token',
    )
    expect(token, 'customer session token in the confirmation URL').toBeTruthy()
    const portal = new Portal(this.app, token!)
    this.app.onCleanup(() => portal.cancelSubscriptions())
    await expect
      .poll(async () => (await this.state()).status, {
        message: 'checkout status',
      })
      .toBe('succeeded')
    return portal
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
