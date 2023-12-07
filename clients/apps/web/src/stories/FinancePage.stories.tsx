import type { Meta, StoryObj } from '@storybook/react'

import Finance from '@/components/Finance/Finance'
import {
  AccountType,
  Pledge,
  PledgeState,
  PledgeType,
  Reward,
  RewardState,
  Status,
} from '@polar-sh/sdk'
import { issue, org } from 'polarkit/testdata'

type Story = StoryObj<typeof Finance>

const meta: Meta<typeof Finance> = {
  title: 'Pages/Finance',
  component: Finance,
  parameters: {
    themes: ['light'],
  },
}

export default meta

const pledge: Pledge = {
  id: 'xx',
  created_at: new Date('2023-06-29').toISOString(),
  // issue_id: 'xx',
  amount: { currency: 'USD', amount: 12300 },
  // repository_id: 'xx',
  // organization_id: 'xx',
  state: PledgeState.CREATED,
  type: PledgeType.UPFRONT,
  // pledger_name: 'Google',
  // pledger_avatar: 'https://avatars.githubusercontent.com/u/1342004?s=200&v=4',
  // authed_user_can_admin: false,
  scheduled_payout_at: new Date('2023-08-02').toISOString(),
  refunded_at: new Date('2023-06-28').toISOString(),
  // authed_user_can_admin_sender: false,
  // authed_user_can_admin_received: false,
  issue: issue,
}

let all_pledge_states: Pledge[] = Object.values(PledgeState).map(
  (s): Pledge => {
    return {
      ...pledge,
      state: s,
      issue: {
        ...pledge.issue,
        title: `${pledge.issue.title} (${s})`,
      },
    }
  },
)

const paidRewardUser: Reward = {
  pledge: pledge,
  user: {
    username: 'petterheterjag',
    avatar_url: 'https://avatars.githubusercontent.com/u/1426460?v=4',
  },
  organization: undefined,
  amount: { currency: 'USD', amount: 4000 },
  state: RewardState.PAID,
}

const pendingRewardUser: Reward = {
  ...paidRewardUser,
  state: RewardState.PENDING,
}

const paidRewardOrg: Reward = {
  ...paidRewardUser,
  user: undefined,
  organization: org,
  state: RewardState.PAID,
}

const pendingRewardOrg: Reward = {
  ...paidRewardOrg,
  state: RewardState.PENDING,
}

const rewards = [
  paidRewardUser,
  pendingRewardUser,
  paidRewardOrg,
  pendingRewardOrg,
]

export const Default: Story = {
  args: {
    pledges: all_pledge_states,
    org: org,
    tab: 'current',
    account: undefined,
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
    pledges: [pledge],
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
    account: {
      id: 'xx',
      account_type: AccountType.STRIPE,
      status: Status.ACTIVE,
      country: 'SE',
      stripe_id: '',
      is_details_submitted: false,
    },
  },
}

export const StripeSetup: Story = {
  ...Default,
  args: {
    ...Default.args,
    tab: 'rewarded',
    account: {
      id: 'xx',
      account_type: AccountType.STRIPE,
      status: Status.ACTIVE,
      country: 'SE',
      stripe_id: 'xxx',
      is_details_submitted: true,
    },
  },
}

// export const StripeSetupNotAdmin: Story = {
//   ...Default,
//   args: {
//     ...Default.args,
//     tab: 'rewarded',
//     accounts: [
//       {
//         id: 'xx',
//         account_type: AccountType.STRIPE,
//         country: 'SE',
//         stripe_id: 'xxx',
//         is_details_submitted: true,
//         is_admin: false,
//       },
//     ],
//   },
// }

export const StripeSetupDark: Story = {
  ...Default,
  args: {
    ...Default.args,
    tab: 'rewarded',
    account: {
      id: 'xx',
      account_type: AccountType.STRIPE,
      status: Status.ACTIVE,
      country: 'SE',
      stripe_id: 'xxx',
      is_details_submitted: true,
    },
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
    account: {
      id: 'xx',
      account_type: AccountType.OPEN_COLLECTIVE,
      status: Status.ACTIVE,
      country: 'SE',
      open_collective_slug: 'polar',
      is_details_submitted: true,
    },
  },
}

export const OpenCollectiveSetupDark: Story = {
  ...Default,
  args: {
    ...Default.args,
    tab: 'rewarded',
    account: {
      id: 'xx',
      account_type: AccountType.OPEN_COLLECTIVE,
      status: Status.ACTIVE,
      country: 'SE',
      open_collective_slug: 'polar',
      is_details_submitted: true,
    },
  },

  parameters: {
    themes: ['dark'],
  },
}
