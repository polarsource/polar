import { schemas } from '@polar-sh/client'

export function addDays(date: Date, days: number) {
  var result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function addHours(date: Date, hours: number) {
  var result = new Date(date)
  result.setHours(result.getHours() + hours)
  return result
}

export const org: schemas['Organization'] = {
  id: 'xxxabc',
  created_at: new Date('2023-01-01T00:00:00Z').toISOString(),
  modified_at: null,
  name: 'Pydantic',
  slug: 'pydantic',
  socials: [],
  website: 'https://pydantic.dev',
  avatar_url: 'https://avatars.githubusercontent.com/u/110818415?s=48&v=4',
  details_submitted_at: null,
  feature_settings: {
    issue_funding_enabled: false,
  },
  email: null,
  subscription_settings: {
    allow_multiple_subscriptions: true,
    allow_customer_updates: true,
    proration_behavior: 'invoice',
  },
  notification_settings: {
    new_order: true,
    new_subscription: true,
  },
}

export const user: schemas['UserRead'] = {
  created_at: new Date('2023-01-01T00:00:00Z').toISOString(),
  modified_at: new Date('2023-01-01T09:00:00Z').toISOString(),
  email: 'test@example.com',
  avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
  identity_verification_status: 'unverified',
  identity_verified: false,
  accepted_terms_of_service: true,
  id: 'xxxabc-123',
  oauth_accounts: [],
  account_id: null,
}

export const payout: schemas['Payout'] = {
  id: 'xxxabc-123',
  created_at: new Date('2023-01-01T00:00:00Z').toISOString(),
  modified_at: new Date('2023-01-01T09:00:00Z').toISOString(),
  amount: 1000,
  status: 'pending',
  processor: 'stripe',
  paid_at: null,
  currency: 'USD',
  fees_amount: 100,
  fees_transactions: [],
  gross_amount: 1000,
  account_currency: 'USD',
  account_amount: 1000,
  account_id: 'xxxabc-123',
  is_invoice_generated: false,
  transaction_id: 'xxxabc-123',
}
