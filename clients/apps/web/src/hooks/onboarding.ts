import { Organization } from '@polar-sh/sdk'

export const shouldBeOnboarded = (organization: Organization) => {
  const {
    donations_enabled,
    issue_funding_enabled,
    subscriptions_enabled,
    articles_enabled,
  } = organization

  return !(
    donations_enabled ||
    issue_funding_enabled ||
    subscriptions_enabled ||
    articles_enabled
  )
}
