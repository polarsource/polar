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
  pledge_minimum_amount: 2000,
  pledge_badge_show_amount: true,
  profile_settings: {
    enabled: false,
    subscribe: null,
  },
  feature_settings: {
    issue_funding_enabled: false,
  },
  default_upfront_split_to_contributors: null,
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

export const externalOrganization: schemas['ExternalOrganization'] = {
  id: '',
  platform: 'github',
  name: 'polarsource',
  avatar_url: 'https://avatars.githubusercontent.com/u/105373340?v=4',
  is_personal: false,
  bio: null,
  pretty_name: null,
  company: null,
  blog: null,
  location: null,
  email: null,
  twitter_username: null,
  organization_id: null,
}

export const repo: schemas['Repository'] = {
  platform: 'github',
  name: 'pydantic',
  id: 'bb',
  is_private: false,
  license: 'Apache 2.0',
  description: 'Data validation using Python type hints',
  homepage: 'https://docs.pydantic.dev/latest/',
  organization: externalOrganization,
  stars: 26000,
  profile_settings: {},
  internal_organization: org,
}

export const reactions: schemas['Reactions'] = {
  total_count: 0,
  plus_one: 0,
  minus_one: 0,
  laugh: 0,
  hooray: 0,
  confused: 0,
  heart: 0,
  rocket: 0,
  eyes: 0,
}

// Public API
export const issue: schemas['Issue'] = {
  platform: 'github',
  number: 222,
  title: 'SecretStr comparison fails when field is defined with Field',
  author: {
    id: 123,
    login: 'zegl',
    avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
    html_url: 'https://github.com/zegl',
  },
  comments: 5,
  reactions: {
    ...reactions,
    total_count: 3,
    plus_one: 3,
  },
  state: 'open',
  id: 'cc',
  issue_created_at: addDays(new Date(), -7).toISOString(),
  repository: repo,
  funding: {},
  needs_confirmation_solved: false,
  pledge_badge_currently_embedded: false,
  labels: [],
}

export const issueBodyHTML = `<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit,
sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
nisi ut aliquip ex ea commodo consequat. <strong>Duis aute irure dolor</strong> in
reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
deserunt mollit anim id est laborum.</p>`

export const pledger: schemas['Pledger'] = {
  name: 'zegl',
  github_username: 'zegl',
  avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
}

export const pledgesSummaries: schemas['PledgesTypeSummaries'] = {
  pay_directly: { total: { currency: 'usd', amount: 0 }, pledgers: [] },
  pay_on_completion: {
    total: { currency: 'usd', amount: 40000 },
    pledgers: [pledger, pledger],
  },
  pay_upfront: {
    total: { currency: 'usd', amount: 10000 },
    pledgers: [pledger],
  },
}

export const issueFunding: schemas['IssueFunding'] = {
  issue,
  funding_goal: { currency: 'usd', amount: 60000 },
  total: { currency: 'usd', amount: 50000 },
  pledges_summaries: pledgesSummaries,
}

// PublicAPI
export const pledgePublicAPI: schemas['Pledge'] = {
  id: 'pppp',
  created_at: '2023-10-11',
  modified_at: null,
  issue: issue,
  amount: 3000,
  currency: 'usd',
  state: 'created',
  type: 'pay_upfront',
  pledger: pledger,
  authed_can_admin_sender: false,
  authed_can_admin_received: false,
}

const maintainerPledgeCreatedNotification: schemas['MaintainerPledgeCreatedNotificationPayload'] =
  {
    pledger_name: 'xx',
    pledge_amount: '123.50',
    issue_url: '#',
    issue_title: 'Hello World',
    issue_org_name: 'polarsource',
    issue_repo_name: 'polar',
    issue_number: 123,
    maintainer_has_stripe_account: false,
    pledge_id: null,
    pledge_type: 'pay_upfront',
  }

const maintainerPledgeConfirmationPendingNotification: schemas['MaintainerPledgeConfirmationPendingNotificationPayload'] =
  {
    pledger_name: 'xx',
    pledge_amount: '123.50',
    issue_url: '#',
    issue_title: 'Hello World',
    issue_org_name: 'polarsource',
    issue_repo_name: 'polar',
    issue_number: 123,
    maintainer_has_stripe_account: false,
    pledge_id: null,
  }

const maintainerPledgePendingNotification: schemas['MaintainerPledgePendingNotificationPayload'] =
  {
    pledger_name: 'xx',
    pledge_amount: '123.50',
    issue_url: '#',
    issue_title: 'Hello World',
    issue_org_name: 'polarsource',
    issue_repo_name: 'polar',
    issue_number: 123,
    maintainer_has_stripe_account: false,
    pledge_id: null,
  }

const maintainerPledgePaidNotification: schemas['MaintainerPledgePaidNotificationPayload'] =
  {
    paid_out_amount: '123.50',
    issue_url: '#',
    issue_title: 'Hello World',
    issue_org_name: 'polarsource',
    issue_repo_name: 'polar',
    issue_number: 123,
    pledge_id: null,
  }

const pledgerPledgePendingNotification: schemas['PledgerPledgePendingNotificationPayload'] =
  {
    pledge_amount: '50.50',
    issue_url: '#',
    issue_title: 'Hello World',
    issue_org_name: 'polarsource',
    issue_repo_name: 'polar',
    issue_number: 123,
    pledge_date: addDays(new Date(), -2).toISOString(),
    pledge_id: null,
    pledge_type: 'pay_upfront',
  }

const rewardPaidNotification: schemas['RewardPaidNotificationPayload'] = {
  paid_out_amount: '123.50',
  issue_url: '#',
  issue_title: 'Hello World',
  issue_org_name: 'polarsource',
  issue_repo_name: 'polar',
  issue_number: 123,
  issue_id: 'xx',
  pledge_id: 'yyy',
}
const maintainerPledgedIssuePendingNotification: schemas['MaintainerPledgedIssuePendingNotificationPayload'] =
  {
    pledge_amount_sum: '123.50',
    issue_url: '#',
    issue_title: 'Hello World',
    issue_org_name: 'polarsource',
    issue_repo_name: 'polar',
    issue_number: 123,
    issue_id: 'xx',
    maintainer_has_account: false,
  }

const maintainerPledgedIssueConfirmationPendingNotification: schemas['MaintainerPledgedIssueConfirmationPendingNotificationPayload'] =
  {
    pledge_amount_sum: '123.50',
    issue_url: '#',
    issue_title: 'Hello World',
    issue_org_name: 'polarsource',
    issue_repo_name: 'polar',
    issue_number: 123,
    issue_id: 'xx',
    maintainer_has_account: false,
  }

export const notification_maintainerPledgeCreatedNotification: schemas['MaintainerPledgeCreatedNotification'] =
  {
    id: 'x',
    created_at: addDays(new Date(), -2).toISOString(),
    type: 'MaintainerPledgeCreatedNotification',
    payload: maintainerPledgeCreatedNotification,
  }

export const notification_maintainerPledgeConfirmationPendingNotification: schemas['MaintainerPledgeConfirmationPendingNotification'] =
  {
    id: 'x',
    created_at: addDays(new Date(), -2).toISOString(),
    type: 'MaintainerPledgeConfirmationPendingNotification',
    payload: maintainerPledgeConfirmationPendingNotification,
  }

export const notification_maintainerPledgePendingNotification: schemas['MaintainerPledgePendingNotification'] =
  {
    id: 'x',
    created_at: addDays(new Date(), -2).toISOString(),
    type: 'MaintainerPledgePendingNotification',
    payload: maintainerPledgePendingNotification,
  }

export const notification_maintainerPledgePaidNotification: schemas['MaintainerPledgePaidNotification'] =
  {
    id: 'x',
    created_at: addDays(new Date(), -2).toISOString(),
    type: 'MaintainerPledgePaidNotification',
    payload: maintainerPledgePaidNotification,
  }

export const notification_pledgerPledgePendingNotification: schemas['PledgerPledgePendingNotification'] =
  {
    id: 'x',
    created_at: addDays(new Date(), -2).toISOString(),
    type: 'PledgerPledgePendingNotification',
    payload: pledgerPledgePendingNotification,
  }

export const notification_rewardPaidNotification: schemas['RewardPaidNotification'] =
  {
    id: 'x',
    created_at: addDays(new Date(), -2).toISOString(),
    type: 'RewardPaidNotification',
    payload: rewardPaidNotification,
  }

export const notification_maintainerPledgedIssuePendingNotification: schemas['MaintainerPledgedIssueConfirmationPendingNotification'] =
  {
    id: 'x',
    created_at: addDays(new Date(), -2).toISOString(),
    type: 'MaintainerPledgedIssueConfirmationPendingNotification',
    payload: maintainerPledgedIssuePendingNotification,
  }

export const notification_maintainerPledgedIssueConfirmationPendingNotification: schemas['MaintainerPledgedIssueConfirmationPendingNotification'] =
  {
    id: 'x',
    created_at: addDays(new Date(), -2).toISOString(),
    type: 'MaintainerPledgedIssueConfirmationPendingNotification',
    payload: maintainerPledgedIssueConfirmationPendingNotification,
  }
