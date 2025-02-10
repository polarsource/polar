import type { Meta, StoryObj } from '@storybook/react'

import { PolarQueryClientProvider } from '@/app/providers'
import Finance from '@/components/Finance/Finance'
import { issue, org } from '@/utils/testdata'
import { schemas } from '@polar-sh/client'

type Story = StoryObj<typeof Finance>

const meta: Meta<typeof Finance> = {
  title: 'Pages/Finance',
  component: Finance,
  parameters: {
    themes: ['light'],
  },
}

export default meta

const pledge: schemas['Pledge'] = {
  id: 'xx',
  created_at: new Date('2023-06-29').toISOString(),
  modified_at: null,
  // issue_id: 'xx',
  amount: 12300,
  currency: 'usd',
  // repository_id: 'xx',
  // organization_id: 'xx',
  state: 'created',
  type: 'pay_upfront',
  // pledger_name: 'Google',
  // pledger_avatar: 'https://avatars.githubusercontent.com/u/1342004?s=200&v=4',
  // authed_user_can_admin: false,
  scheduled_payout_at: new Date('2023-08-02').toISOString(),
  refunded_at: new Date('2023-06-28').toISOString(),
  issue: issue,
  authed_can_admin_received: false,
  authed_can_admin_sender: false,
}

let all_pledge_states: schemas['Pledge'][] = [
  'initiated',
  'created',
  'pending',
  'refunded',
  'disputed',
  'charge_disputed',
  'cancelled',
].map((s): schemas['Pledge'] => {
  return {
    ...pledge,
    state: s as schemas['PledgeState'],
    issue: {
      ...pledge.issue,
      title: `${pledge.issue.title} (${s})`,
    },
  }
})

const paidRewardUser: schemas['Reward'] = {
  pledge: pledge,
  user: {
    public_name: 'Petter',
    avatar_url: 'https://avatars.githubusercontent.com/u/1426460?v=4',
  },
  organization: undefined,
  amount: { currency: 'usd', amount: 4000 },
  state: 'paid',
}

const pendingRewardUser: schemas['Reward'] = {
  ...paidRewardUser,
  state: 'pending',
}

const paidRewardOrg: schemas['Reward'] = {
  ...paidRewardUser,
  user: undefined,
  organization: org,
  state: 'paid',
}

const pendingRewardOrg: schemas['Reward'] = {
  ...paidRewardOrg,
  state: 'pending',
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
    rewards: rewards,
  },
  render: (args) => (
    <PolarQueryClientProvider>
      <Finance {...args} />
    </PolarQueryClientProvider>
  ),
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
