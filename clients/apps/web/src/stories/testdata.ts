import {
  IssueRead,
  MaintainerPledgeCreatedNotification,
  MaintainerPledgePaidNotification,
  MaintainerPledgePendingNotification,
  NotificationRead,
  NotificationType,
  OrganizationPrivateRead,
  OrganizationPublicRead,
  Platforms,
  PledgeRead,
  PledgeState,
  PledgerPledgePendingNotification,
  RepositoryRead,
  State,
  Status,
  UserRead,
  Visibility,
} from 'polarkit/api/client'

export const org: OrganizationPublicRead = {
  id: 'xxxabc',
  platform: Platforms.GITHUB,
  name: 'pydantic',
  avatar_url: 'https://avatars.githubusercontent.com/u/110818415?s=48&v=4',
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

export const issue: IssueRead = {
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
  issue_created_at: '2023-04-08',
  external_id: 123,
  created_at: '2023-04-08',
}

export const repo: RepositoryRead = {
  platform: Platforms.GITHUB,
  external_id: 123,
  name: 'pydantic',
  id: 'bb',
  visibility: Visibility.PUBLIC,
  is_private: false,
  license: 'Apache 2.0',
}

export const pledge: PledgeRead = {
  id: 'pppp',
  created_at: '2023-04-02',
  issue_id: issue.id,
  amount: 3000,
  repository_id: repo.id,
  organization_id: org.id,
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
  status: Status.ACTIVE,
  created_at: '2023-01-01',
  repositories: [
    {
      platform: Platforms.GITHUB,
      external_id: 1245,
      organization_id: 'xxxxx-abc',
      name: 'polar',
      is_private: false,
      id: 'xxxxrepo',
      visibility: Visibility.PUBLIC,
    },
  ],
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
  pledge_date: '2023-03-24',
}

export const notification_maintainerPledgeCreatedNotification: NotificationRead =
  {
    id: 'x',
    created_at: '2023-05-02',
    type: NotificationType.MAINTAINER_PLEDGE_CREATED_NOTIFICATION,
    payload: maintainerPledgeCreatedNotification,
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
