import { actionClicking, actionFilling } from './utils/app'
import {
  API_URL,
  BILLING_ADDRESS,
  CARD,
  CHECKOUT_LINK,
  STRIPE_FRAME,
} from './utils/constants'
import { describe, expect, test } from './utils/test'

type Checkout = {
  status: string
  trial_end: string | null
  customer_email: string | null
  customer_name: string | null
  customer_billing_address: {
    country: string
    line1: string | null
    postal_code: string | null
    city: string | null
    state: string | null
  } | null
}
type Subscriptions = {
  items: Array<{
    id: string
    status: string
    ended_at: string | null
    cancel_at_period_end: boolean
  }>
}

describe('Trial subscription', () => {
  test('starts a trial subscription and cancels it', async ({ app }) => {
    await app.goto(`${API_URL}/v1/checkout-links/${CHECKOUT_LINK}/redirect`)
    const clientSecret = (await app.url()).match(/\/checkout\/([^/?#]+)/)?.[1]
    expect(clientSecret).toBeTruthy()
    const checkout = () =>
      app.api<Checkout>(`/v1/checkouts/client/${clientSecret}`)
    if (!(await checkout()).trial_end) {
      throw new Error(
        `Checkout link ${CHECKOUT_LINK} has no free trial: refusing to submit a card that would be charged`,
      )
    }

    const email = `e2e+${Date.now()}@polar.sh`
    const name = 'E2E Tester'
    const plan = await app.plan(
      'Find the email field, the cardholder name field and the button that starts the trial',
      { email, name },
    )
    await app.fill(
      actionFilling(plan, 'email'),
      { email },
      async () => (await checkout()).customer_email === email,
    )
    await app.fill(
      actionFilling(plan, 'name'),
      { name },
      async () => (await checkout()).customer_name === name,
    )
    const address = async () => (await checkout()).customer_billing_address
    const { country, line1, postalCode, city, state } = BILLING_ADDRESS
    if ((await address())?.country !== country) {
      const countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(
        country,
      )
      await app.select(
        'billing address country',
        countryName!,
        async () => (await address())?.country === country,
      )
    }
    const addressPlan = await app.plan(
      'Find the street address, postal code and city fields of the billing address',
      { line1, postalCode, city },
    )
    await app.fill(
      actionFilling(addressPlan, 'line1'),
      { line1 },
      async () => (await address())?.line1 === line1,
    )
    await app.fill(
      actionFilling(addressPlan, 'postalCode'),
      { postalCode },
      async () => (await address())?.postal_code === postalCode,
    )
    await app.fill(
      actionFilling(addressPlan, 'city'),
      { city },
      async () => (await address())?.city === city,
    )
    await app.select(
      'billing address state',
      state.name,
      async () => (await address())?.state === `${country}-${state.code}`,
    )
    await app.type(`${STRIPE_FRAME} >> input[name="number"]`, CARD.number)
    await app.type(`${STRIPE_FRAME} >> input[name="expiry"]`, CARD.expiry)
    await app.type(`${STRIPE_FRAME} >> input[name="cvc"]`, CARD.cvc)
    await app.click(
      actionClicking(plan),
      async () => (await checkout()).status !== 'open',
    )

    await expect
      .poll(() => app.url(), { message: 'confirmation page' })
      .toContain('/confirmation')
    const token = new URL(await app.url()).searchParams.get(
      'customer_session_token',
    )
    expect(token).toBeTruthy()
    const subscriptions = () =>
      app.api<Subscriptions>('/v1/customer-portal/subscriptions/', {
        token: token!,
      })
    const cancelAll = async () => {
      const live = (await subscriptions()).items.filter(
        (s) => !s.ended_at && !s.cancel_at_period_end,
      )
      for (const { id } of live) {
        await app.api(`/v1/customer-portal/subscriptions/${id}`, {
          method: 'DELETE',
          token: token!,
        })
      }
    }
    app.onCleanup(cancelAll)

    await expect
      .poll(async () => (await checkout()).status, {
        message: 'checkout status',
      })
      .toBe('succeeded')
    await expect
      .poll(async () => (await subscriptions()).items.map((s) => s.status), {
        message: 'subscription statuses',
      })
      .toContain('trialing')

    await cancelAll()
    await expect
      .poll(
        async () =>
          (await subscriptions()).items.map((s) => s.cancel_at_period_end),
        { message: 'subscriptions cancelled at the end of the trial' },
      )
      .not.toContain(false)
  })
})
