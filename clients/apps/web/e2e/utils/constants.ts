export const API_URL = (
  process.env.E2E_API_URL ?? 'http://127.0.0.1:8000'
).replace(/\/$/, '')

export const CHECKOUT_LINK =
  process.env.E2E_CHECKOUT_LINK || 'polar_cl_e2e_seed_trial_subscription'

export const CARD = {
  number: process.env.E2E_CARD_NUMBER || '4242424242424242',
  expiry: process.env.E2E_CARD_EXPIRY || '1234',
  cvc: process.env.E2E_CARD_CVC || '123',
}

export const STRIPE_FRAME = 'iframe[name^="__privateStripeFrame"]'

export const BILLING_ADDRESS = {
  country: 'US',
  line1: '548 Market St',
  postalCode: '94104',
  city: 'San Francisco',
  state: { code: 'CA', name: 'California' },
}

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY
export const CHROME_PATH = process.env.E2E_CHROME_PATH
export const CHROMIUM_SANDBOX = !process.env.CI
export const HEADLESS = !process.env.E2E_HEADED
