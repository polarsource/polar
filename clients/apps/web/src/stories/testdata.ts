import {
  IssueRead,
  OrganizationPrivateRead,
  OrganizationPublicRead,
  OrganizationStripeCustomerRead,
  Platforms,
  PledgeRead,
  PledgeState,
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

export const orgStripeCustomer: OrganizationStripeCustomerRead = {
  // email?: string;
  // addressCity?: string;
  // addressCountry?: string;
  // addressLine1?: string;
  // addressLine2?: string;
  // postalCode?: string;
  // state?: string;
  default_payment_method: {
    type: 'card',
    card_last4: '4242',
    card_brand: 'visa',
  },
}
