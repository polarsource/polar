import { CONFIG } from '@/utils/config'

export type StripeKeyMode = 'live' | 'test'

export type StripePermission = {
  group: 'Core' | 'Billing' | 'Connect'
  resource: string
  access: 'Read' | 'Write'
  hint?: string
}

// Row names and groups as Stripe's restricted-key form shows them (resource
// names stay in English in every Dashboard language). Keep in sync with
// StripeAdapter.verify_scopes.
export const REQUIRED_PERMISSIONS: StripePermission[] = [
  { group: 'Core', resource: 'Customers', access: 'Read' },
  { group: 'Core', resource: 'Products', access: 'Read' },
  { group: 'Core', resource: 'Payment Methods', access: 'Read' },
  { group: 'Billing', resource: 'Prices', access: 'Read' },
  { group: 'Billing', resource: 'Coupons', access: 'Read' },
  { group: 'Billing', resource: 'Promotion Codes', access: 'Read' },
  {
    group: 'Billing',
    resource: 'Subscriptions',
    access: 'Write',
    hint: 'Also covers subscription schedules',
  },
  { group: 'Billing', resource: 'Invoices', access: 'Read' },
  {
    group: 'Connect',
    resource: 'Accounts',
    access: 'Read',
    hint: 'Listed under Connect, even if you don’t use Connect',
  },
]

// Includes the labels older API versions returned, so a skewed deploy still
// highlights the right row.
const SCOPE_TO_RESOURCE: Record<string, string> = {
  Customers: 'Customers',
  Products: 'Products',
  Prices: 'Prices',
  Coupons: 'Coupons',
  'Promotion Codes': 'Promotion Codes',
  'Promotion codes': 'Promotion Codes',
  Subscriptions: 'Subscriptions',
  'Subscriptions (write)': 'Subscriptions',
  'Subscription schedules': 'Subscriptions',
  Invoices: 'Invoices',
  'Payment Methods': 'Payment Methods',
  'Payment methods': 'Payment Methods',
  Accounts: 'Accounts',
  'All accounts': 'Accounts',
}

const MISSING_ACCESS_PREFIX = 'The Stripe API key is missing access to: '

export function expectedStripeKeyMode(
  environment: string = CONFIG.ENVIRONMENT,
): StripeKeyMode {
  return environment === 'production' ? 'live' : 'test'
}

export function stripeKeyPlaceholder(
  mode: StripeKeyMode = expectedStripeKeyMode(),
): string {
  return `rk_${mode}_...`
}

export function stripeCreateKeyUrl(
  mode: StripeKeyMode = expectedStripeKeyMode(),
): string {
  return mode === 'live'
    ? 'https://dashboard.stripe.com/apikeys/create'
    : 'https://dashboard.stripe.com/test/apikeys/create'
}

const STRIPE_KEY_PREFIX = /^(rk|sk)_(live|test)_/

function isLiveStripeKey(apiKey: string): boolean {
  return apiKey.startsWith('rk_live_') || apiKey.startsWith('sk_live_')
}

export function stripeKeyError(
  apiKey: string,
  mode: StripeKeyMode = expectedStripeKeyMode(),
): string | null {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    return null
  }
  if (!STRIPE_KEY_PREFIX.test(trimmed)) {
    return `Paste a Stripe restricted key starting with rk_${mode}_.`
  }
  if (isLiveStripeKey(trimmed) !== (mode === 'live')) {
    return (
      `This Polar environment needs a ${mode}-mode Stripe key ` +
      `(e.g. \`rk_${mode}_…\`), so the migration runs against ${mode} data.`
    )
  }
  return null
}

export function parseMissingStripeScopes(error: {
  error?: string
  detail?: unknown
}): string[] {
  if (error.error && error.error !== 'MissingStripeScopes') {
    return []
  }
  if (typeof error.detail !== 'string') {
    return []
  }
  if (
    !error.detail.startsWith(MISSING_ACCESS_PREFIX) ||
    !error.detail.endsWith('.')
  ) {
    return []
  }
  const listed = error.detail.slice(MISSING_ACCESS_PREFIX.length, -1)
  if (!listed) {
    return []
  }
  const resources = new Set<string>()
  for (const label of listed.split(', ')) {
    const resource = SCOPE_TO_RESOURCE[label]
    if (resource) {
      resources.add(resource)
    }
  }
  return [...resources]
}
