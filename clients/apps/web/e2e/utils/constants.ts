export const API_URL = (
  process.env.E2E_API_URL ?? 'http://127.0.0.1:8000'
).replace(/\/$/, '')

export const ORG_TOKEN = process.env.E2E_ORG_TOKEN

export const CARD = { number: '4242424242424242', expiry: '1234', cvc: '123' }
export const DECLINED_CARD = { ...CARD, number: '4000000000000002' }
export const THREE_D_SECURE_CARD = { ...CARD, number: '4000002500003155' }

export const BILLING_ADDRESS = {
  country: 'US',
  line1: '548 Market St',
  postalCode: '94104',
  city: 'San Francisco',
  state: { code: 'CA', name: 'California' },
}

export const HEADLESS = !process.env.E2E_HEADED
export const WEBHOOK_TIMEOUT = 120_000
export const CONFIRMATION_INTERVAL = 10_000
