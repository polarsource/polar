import type { Meta, StoryObj } from '@storybook/react'

import Finance from '@/components/Finance/Finance'
import {
  AccountType,
  Pledge,
  PledgeResources,
  PledgeState,
  Reward,
  RewardState,
} from 'polarkit/api/client'
import { issue, issueRead, org, orgPrivate, repo } from './testdata'

type Story = StoryObj<typeof Finance>

const meta: Meta<typeof Finance> = {
  title: 'Pages/Finance',
  component: Finance,
  parameters: {
    themes: ['light'],
  },
}

export default meta

const pr: PledgeResources = {
  pledge: {
    id: 'xx',
    created_at: '2023-06-29',
    issue_id: 'xx',
    amount: 12300,
    repository_id: 'xx',
    organization_id: 'xx',
    state: PledgeState.CREATED,
    pledger_name: 'Google',
    pledger_avatar: 'https://avatars.githubusercontent.com/u/1342004?s=200&v=4',
    authed_user_can_admin: false,
    scheduled_payout_at: '2023-08-02',
    paid_at: '2023-06-28',
    refunded_at: '2023-06-28',
    authed_user_can_admin_sender: false,
    authed_user_can_admin_received: false,
  },
  issue: issue,
  repository: repo,
  organization: org,
}

let all_pledge_states: PledgeResources[] = Object.values(PledgeState).map(
  (s) => {
    return {
      ...pr,
      pledge: {
        ...pr.pledge,
        state: s,
      },
      issue: {
        ...issue,
        title: `${issueRead.title} (${s})`,
      },
    }
  },
)

const pledge: Pledge = {
  id: 'xx',
  created_at: '2023-06-29',
  // issue_id: 'xx',
  amount: { currency: 'USD', amount: 12300 },
  // repository_id: 'xx',
  // organization_id: 'xx',
  state: PledgeState.CREATED,
  // pledger_name: 'Google',
  // pledger_avatar: 'https://avatars.githubusercontent.com/u/1342004?s=200&v=4',
  // authed_user_can_admin: false,
  scheduled_payout_at: '2023-08-02',
  paid_at: '2023-06-28',
  refunded_at: '2023-06-28',
  issue: issue,
  // authed_user_can_admin_sender: false,
  // authed_user_can_admin_received: false,
}

const paidRewardUser: Reward = {
  pledge: pledge,
  user: { username: 'foobar', avatar_url: 'xxx' },
  organization: undefined,
  amount: 4000, // TODO: SHOULD BE CURRENCY AMOUNT
  state: RewardState.PAID,
}

const paidRewardOrg: Reward = {
  pledge: pledge,
  user: { username: 'foobar', avatar_url: 'xxx' },
  organization: org,
  amount: 4000, // TODO: SHOULD BE CURRENCY AMOUNT
  state: RewardState.PAID,
}

const pendingRewardOrg: Reward = {
  pledge: pledge,
  user: { username: 'foobar', avatar_url: 'xxx' },
  organization: org,
  amount: 4000, // TODO: SHOULD BE CURRENCY AMOUNT
  state: RewardState.PENDING,
}

const rewards = [paidRewardUser, paidRewardOrg, pendingRewardOrg]

export const Default: Story = {
  args: {
    pledges: all_pledge_states,
    org: orgPrivate,
    tab: 'current',
    accounts: [],
    rewards: rewards,
  },
}

export const Rewarded: Story = {
  ...Default,
  args: {
    ...Default.args,
    tab: 'rewarded',
    rewards: rewards,
  },
}

export const Contributors: Story = {
  ...Default,
  args: {
    ...Default.args,
    tab: 'contributors',
    pledges: [pr],
    rewards: rewards,
  },
}

export const Dark: Story = {
  ...Default,
  args: {
    ...Default.args,
    tab: 'current',
  },
  parameters: {
    themes: ['dark'],
  },
}

export const StripeHalfSetup: Story = {
  ...Default,
  args: {
    ...Default.args,
    tab: 'rewarded',
    accounts: [
      {
        id: 'xx',
        account_type: AccountType.STRIPE,
        country: 'SE',
        stripe_id: '',
        is_details_submitted: false,
        is_admin: true,
      },
    ],
  },
}

export const StripeSetup: Story = {
  ...Default,
  args: {
    ...Default.args,
    tab: 'rewarded',
    accounts: [
      {
        id: 'xx',
        account_type: AccountType.STRIPE,
        country: 'SE',
        stripe_id: 'xxx',
        is_details_submitted: true,
        is_admin: true,
      },
    ],
  },
}

export const StripeSetupNotAdmin: Story = {
  ...Default,
  args: {
    ...Default.args,
    tab: 'rewarded',
    accounts: [
      {
        id: 'xx',
        account_type: AccountType.STRIPE,
        country: 'SE',
        stripe_id: 'xxx',
        is_details_submitted: true,
        is_admin: false,
      },
    ],
  },
}

export const StripeSetupDark: Story = {
  ...Default,
  args: {
    ...Default.args,
    tab: 'rewarded',
    accounts: [
      {
        id: 'xx',
        account_type: AccountType.STRIPE,
        country: 'SE',
        stripe_id: 'xxx',
        is_details_submitted: true,
        is_admin: true,
      },
    ],
  },

  parameters: {
    themes: ['dark'],
  },
}

export const OpenCollectiveSetup: Story = {
  ...Default,
  args: {
    ...Default.args,
    tab: 'rewarded',
    accounts: [
      {
        id: 'xx',
        account_type: AccountType.OPEN_COLLECTIVE,
        country: 'SE',
        open_collective_slug: 'polar',
        is_details_submitted: true,
        is_admin: true,
      },
    ],
  },
}

export const OpenCollectiveSetupDark: Story = {
  ...Default,
  args: {
    ...Default.args,
    tab: 'rewarded',
    accounts: [
      {
        id: 'xx',
        account_type: AccountType.OPEN_COLLECTIVE,
        country: 'SE',
        open_collective_slug: 'polar',
        is_details_submitted: true,
        is_admin: true,
      },
    ],
  },

  parameters: {
    themes: ['dark'],
  },
}
