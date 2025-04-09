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
  bio: null,
  company: null,
  blog: null,
  location: null,
  email: null,
  twitter_username: null,
  subscription_settings: {
    allow_multiple_subscriptions: true,
    allow_customer_updates: true,
    proration_behavior: 'invoice',
  },
}

export const user: schemas['UserRead'] = {
  created_at: new Date('2023-01-01T00:00:00Z').toISOString(),
  modified_at: new Date('2023-01-01T09:00:00Z').toISOString(),
  email: 'test@example.com',
  avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
  accepted_terms_of_service: true,
  id: 'xxxabc-123',
  oauth_accounts: [],
  account_id: null,
}
