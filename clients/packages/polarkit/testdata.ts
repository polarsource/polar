import {
  Issue,
  IssueFunding,
  IssueStateEnum,
  MaintainerPledgeConfirmationPendingNotification,
  MaintainerPledgeCreatedNotification,
  MaintainerPledgePaidNotification,
  MaintainerPledgePendingNotification,
  MaintainerPledgedIssueConfirmationPendingNotification,
  MaintainerPledgedIssuePendingNotification,
  NotificationRead,
  NotificationType,
  Organization,
  OrganizationPrivateRead,
  Platforms,
  Pledge,
  PledgeState,
  PledgeType,
  Pledger,
  PledgerPledgePendingNotification,
  PledgesTypeSummaries,
  PullRequest,
  Reactions,
  Repository,
  RewardPaidNotification,
  UserRead,
  Visibility,
} from '@polar-sh/sdk'

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

export const org: Organization = {
  id: 'xxxabc',
  platform: Platforms.GITHUB,
  name: 'pydantic',
  avatar_url: 'https://avatars.githubusercontent.com/u/110818415?s=48&v=4',
  pledge_minimum_amount: 2000,
  pretty_name: 'Pydantic',
  pledge_badge_show_amount: true,
}

export const orgPrivate: OrganizationPrivateRead = {
  ...org,
  is_personal: false,
  external_id: 123,
  created_at: new Date().toISOString(),
  pledge_minimum_amount: 2000,
}

export const user: UserRead = {
  created_at: new Date('2023-01-01T00:00:00Z').toISOString(),
  modified_at: new Date('2023-01-01T09:00:00Z').toISOString(),
  username: 'zegl',
  email: 'test@example.com',
  avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
  accepted_terms_of_service: true,
  id: 'xxxabc-123',
  profile: {},
  email_newsletters_and_changelogs: false,
  email_promotions_and_events: false,
  oauth_accounts: [],
}

// Public API
export const repo: Repository = {
  platform: Platforms.GITHUB,
  name: 'pydantic',
  id: 'bb',
  visibility: Visibility.PUBLIC,
  license: 'Apache 2.0',
  description: 'Data validation using Python type hints',
  homepage: 'https://docs.pydantic.dev/latest/',
  organization: org,
  stars: 26000,
}

export const reactions: Reactions = {
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
export const issue: Issue = {
  platform: Platforms.GITHUB,
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
  state: IssueStateEnum.OPEN,
  id: 'cc',
  issue_created_at: addDays(new Date(), -7).toISOString(),
  repository: repo,
  funding: {},
  needs_confirmation_solved: false,
  pledge_badge_currently_embedded: false,
}

export const issueBodyHTML = `<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit,
sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
nisi ut aliquip ex ea commodo consequat. <strong>Duis aute irure dolor</strong> in
reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
deserunt mollit anim id est laborum.</p>`

export const pledger: Pledger = {
  name: 'zegl',
  github_username: 'zegl',
  avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
}

export const pledgesSummaries: PledgesTypeSummaries = {
  pay_directly: { total: { currency: 'USD', amount: 0 }, pledgers: [] },
  pay_on_completion: {
    total: { currency: 'USD', amount: 40000 },
    pledgers: [pledger, pledger],
  },
  pay_upfront: {
    total: { currency: 'USD', amount: 10000 },
    pledgers: [pledger],
  },
}

export const issueFunding: IssueFunding = {
  issue,
  funding_goal: { currency: 'USD', amount: 60000 },
  total: { currency: 'USD', amount: 50000 },
  pledges_summaries: pledgesSummaries,
}

// PublicAPI
export const pledgePublicAPI: Pledge = {
  id: 'pppp',
  created_at: addDays(new Date(), -7).toISOString(),
  issue: issue,
  amount: { currency: 'USD', amount: 3000 },
  state: PledgeState.CREATED,
  type: PledgeType.UPFRONT,
  pledger: pledger,
}

export const privateOrganization: OrganizationPrivateRead = {
  id: 'xxxxx-abc',
  platform: Platforms.GITHUB,
  name: 'polarsource',
  avatar_url: 'https://avatars.githubusercontent.com/u/105373340?s=400&v=4',
  external_id: 123,
  is_personal: false,
  created_at: addDays(new Date(), -7).toISOString(),
  pledge_minimum_amount: 2000,
}

const maintainerPledgeCreatedNotification: MaintainerPledgeCreatedNotification =
  {
    pledger_name: 'xx',
    pledge_amount: '123.50',
    issue_url: '#',
    issue_title: 'Hello World',
    issue_org_name: 'polarsource',
    issue_repo_name: 'polar',
    issue_number: 123,
    maintainer_has_stripe_account: false,
  }

const maintainerPledgeConfirmationPendingNotification: MaintainerPledgeConfirmationPendingNotification =
  {
    pledger_name: 'xx',
    pledge_amount: '123.50',
    issue_url: '#',
    issue_title: 'Hello World',
    issue_org_name: 'polarsource',
    issue_repo_name: 'polar',
    issue_number: 123,
    maintainer_has_stripe_account: false,
  }

const maintainerPledgePendingNotification: MaintainerPledgePendingNotification =
  {
    pledger_name: 'xx',
    pledge_amount: '123.50',
    issue_url: '#',
    issue_title: 'Hello World',
    issue_org_name: 'polarsource',
    issue_repo_name: 'polar',
    issue_number: 123,
    maintainer_has_stripe_account: false,
  }

const maintainerPledgePaidNotification: MaintainerPledgePaidNotification = {
  paid_out_amount: '123.50',
  issue_url: '#',
  issue_title: 'Hello World',
  issue_org_name: 'polarsource',
  issue_repo_name: 'polar',
  issue_number: 123,
}

const pledgerPledgePendingNotification: PledgerPledgePendingNotification = {
  pledge_amount: '50.50',
  issue_url: '#',
  issue_title: 'Hello World',
  issue_org_name: 'polarsource',
  issue_repo_name: 'polar',
  issue_number: 123,
  pledge_date: addDays(new Date(), -2).toISOString(),
}

const rewardPaidNotification: RewardPaidNotification = {
  paid_out_amount: '123.50',
  issue_url: '#',
  issue_title: 'Hello World',
  issue_org_name: 'polarsource',
  issue_repo_name: 'polar',
  issue_number: 123,
  issue_id: 'xx',
  pledge_id: 'yyy',
}
const maintainerPledgedIssuePendingNotification: MaintainerPledgedIssuePendingNotification =
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

const maintainerPledgedIssueConfirmationPendingNotification: MaintainerPledgedIssueConfirmationPendingNotification =
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

export const notification_maintainerPledgeCreatedNotification: NotificationRead =
  {
    id: 'x',
    created_at: addDays(new Date(), -2).toISOString(),
    type: NotificationType.MAINTAINER_PLEDGE_CREATED_NOTIFICATION,
    maintainer_pledge_created: maintainerPledgeCreatedNotification,
  }

export const notification_maintainerPledgeConfirmationPendingNotification: NotificationRead =
  {
    id: 'x',
    created_at: addDays(new Date(), -2).toISOString(),
    type: NotificationType.MAINTAINER_PLEDGE_CONFIRMATION_PENDING_NOTIFICATION,
    maintainer_pledge_confirmation_pending:
      maintainerPledgeConfirmationPendingNotification,
  }

export const notification_maintainerPledgePendingNotification: NotificationRead =
  {
    id: 'x',
    created_at: addDays(new Date(), -2).toISOString(),
    type: NotificationType.MAINTAINER_PLEDGE_PENDING_NOTIFICATION,
    maintainer_pledge_pending: maintainerPledgePendingNotification,
  }

export const notification_maintainerPledgePaidNotification: NotificationRead = {
  id: 'x',
  created_at: addDays(new Date(), -2).toISOString(),
  type: NotificationType.MAINTAINER_PLEDGE_PAID_NOTIFICATION,
  maintainer_pledge_paid: maintainerPledgePaidNotification,
}

export const notification_pledgerPledgePendingNotification: NotificationRead = {
  id: 'x',
  created_at: addDays(new Date(), -2).toISOString(),
  type: NotificationType.PLEDGER_PLEDGE_PENDING_NOTIFICATION,
  pledger_pledge_pending: pledgerPledgePendingNotification,
}

export const notification_rewardPaidNotification: NotificationRead = {
  id: 'x',
  created_at: addDays(new Date(), -2).toISOString(),
  type: NotificationType.REWARD_PAID_NOTIFICATION,
  reward_paid: rewardPaidNotification,
}

export const notification_maintainerPledgedIssuePendingNotification: NotificationRead =
  {
    id: 'x',
    created_at: addDays(new Date(), -2).toISOString(),
    type: NotificationType.MAINTAINER_PLEDGED_ISSUE_PENDING_NOTIFICATION,
    maintainer_pledged_issue_pending: maintainerPledgedIssuePendingNotification,
  }

export const notification_maintainerPledgedIssueConfirmationPendingNotification: NotificationRead =
  {
    id: 'x',
    created_at: addDays(new Date(), -2).toISOString(),
    type: NotificationType.MAINTAINER_PLEDGED_ISSUE_CONFIRMATION_PENDING_NOTIFICATION,
    maintainer_pledged_issue_confirmation_pending:
      maintainerPledgedIssueConfirmationPendingNotification,
  }

export const pullRequest: PullRequest = {
  id: '12355',
  number: 1337,
  title: 'Hello `world` from a PR',
  additions: 20,
  deletions: 20,
  is_merged: true,
  is_closed: true,
}
