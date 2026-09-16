import { CONFIG } from '@/utils/config'

export type StripeKeyMode = 'live' | 'test'

export type StripePermission = {
  resource: string
  access: 'Read' | 'Write'
}

// Stripe's restricted-key form. Keep in sync with StripeAdapter.verify_scopes.
export const REQUIRED_PERMISSIONS: StripePermission[] = [
  { resource: 'Customers', access: 'Read' },
  { resource: 'Products', access: 'Read' },
  { resource: 'Prices', access: 'Read' },
  { resource: 'Subscriptions', access: 'Write' },
  { resource: 'Payment methods', access: 'Read' },
  { resource: 'All accounts', access: 'Read' },
]

const SCOPE_TO_RESOURCE: Record<string, string> = {
  Customers: 'Customers',
  Products: 'Products',
  Prices: 'Prices',
  Subscriptions: 'Subscriptions',
  'Subscriptions (write)': 'Subscriptions',
  'Payment methods': 'Payment methods',
  'All accounts': 'All accounts',
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
