import {
  Issue,
  IssueRead,
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
  PledgeRead,
  PledgeState,
  PledgerPledgePendingNotification,
  Repository,
  RewardPaidNotification,
  State,
  UserRead,
  Visibility,
} from 'polarkit/api/client'

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
}

export const orgPrivate: OrganizationPrivateRead = {
  ...org,
  is_personal: false,
  external_id: 123,
  created_at: '2024',
  pledge_minimum_amount: 2000,
}

export const user: UserRead = {
  username: 'zegl',
  email: 'test@example.com',
  avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
  invite_only_approved: true,
  accepted_terms_of_service: true,
  id: 'xxxabc-123',
  profile: {},
  email_newsletters_and_changelogs: false,
  email_promotions_and_events: false,
}

export const issueRead: IssueRead = {
  platform: Platforms.GITHUB,
  organization_id: 'aa',
  repository_id: 'bb',
  number: 222,
  title: 'SecretStr comparison fails when field is defined with Field',
  reactions: {
    plus_one: 3,
  },
  state: State.OPEN,
  id: 'cc',
  issue_created_at: addDays(new Date(), -7).toISOString(),
  external_id: 123,
  created_at: addDays(new Date(), -7).toISOString(),
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
}

// Public API
export const issue: Issue = {
  platform: Platforms.GITHUB,
  number: 222,
  title: 'SecretStr comparison fails when field is defined with Field',
  reactions: {
    total_count: 3,
    plus_one: 3,
    minus_one: 0,
    laugh: 0,
    hooray: 0,
    confused: 0,
    heart: 0,
    rocket: 0,
    eyes: 0,
  },
  state: Issue.state.OPEN,
  id: 'cc',
  issue_created_at: addDays(new Date(), -7).toISOString(),
  repository: repo,
  funding: {},
}

export const pledge: PledgeRead = {
  id: 'pppp',
  created_at: addDays(new Date(), -7).toISOString(),
  issue_id: issueRead.id,
  amount: 3000,
  repository_id: repo.id,
  organization_id: org.id,
  state: PledgeState.CREATED,
  // pledger_name?: string;
  // pledger_avatar?: string;
  // authed_user_can_admin?: boolean;
  //scheduled_payout_at?: string;
}

// PublicAPI
export const pledgePublicAPI: Pledge = {
  id: 'pppp',
  created_at: addDays(new Date(), -7).toISOString(),
  // issue_id: issueRead.id,
  issue: issue,
  amount: { currency: 'USD', amount: 3000 },
  // repository_id: repo.id,
  // organization_id: org.id,
  state: PledgeState.CREATED,
  // pledger_name?: string;
  // pledger_avatar?: string;
  // authed_user_can_admin?: boolean;
  //scheduled_payout_at?: string;
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
    payload: maintainerPledgeCreatedNotification,
  }

export const notification_maintainerPledgeConfirmationPendingNotification = {
  ...notification_maintainerPledgeCreatedNotification,
  type: NotificationType.MAINTAINER_PLEDGE_CONFIRMATION_PENDING_NOTIFICATION,
  payload: maintainerPledgeConfirmationPendingNotification,
}

export const notification_maintainerPledgePendingNotification = {
  ...notification_maintainerPledgeCreatedNotification,
  type: NotificationType.MAINTAINER_PLEDGE_PENDING_NOTIFICATION,
  payload: maintainerPledgePendingNotification,
}

export const notification_maintainerPledgePaidNotification = {
  ...notification_maintainerPledgeCreatedNotification,
  type: NotificationType.MAINTAINER_PLEDGE_PAID_NOTIFICATION,
  payload: maintainerPledgePaidNotification,
}

export const notification_pledgerPledgePendingNotification = {
  ...notification_maintainerPledgeCreatedNotification,
  type: NotificationType.PLEDGER_PLEDGE_PENDING_NOTIFICATION,
  payload: pledgerPledgePendingNotification,
}

export const notification_rewardPaidNotification = {
  ...notification_maintainerPledgeCreatedNotification,
  type: NotificationType.REWARD_PAID_NOTIFICATION,
  payload: rewardPaidNotification,
}

export const notification_maintainerPledgedIssuePendingNotification = {
  ...notification_maintainerPledgeCreatedNotification,
  type: NotificationType.MAINTAINER_PLEDGED_ISSUE_PENDING_NOTIFICATION,
  payload: maintainerPledgedIssuePendingNotification,
}

export const notification_maintainerPledgedIssueConfirmationPendingNotification =
  {
    ...notification_maintainerPledgeCreatedNotification,
    type: NotificationType.MAINTAINER_PLEDGED_ISSUE_CONFIRMATION_PENDING_NOTIFICATION,
    payload: maintainerPledgedIssueConfirmationPendingNotification,
  }
