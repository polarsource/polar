import type { Meta, StoryObj } from '@storybook/react'

import List from '@/components/Finance/ListRewards'
import { issue } from '@/utils/testdata'
import { components } from '@polar-sh/client'

type Story = StoryObj<typeof List>

const meta: Meta<typeof List> = {
  title: 'Organisms/FinanceRewardsList',
  component: List,
  tags: ['autodocs'],
}

export default meta

const pledge: components['schemas']['Pledge'] = {
  id: 'xx',
  created_at: new Date('2023-06-29').toISOString(),
  modified_at: null,
  amount: 12300,
  currency: 'usd',
  state: 'created',
  type: 'pay_upfront',
  scheduled_payout_at: undefined,
  issue: issue,
  authed_can_admin_received: false,
  authed_can_admin_sender: false,
}

const reward: components['schemas']['Reward'] = {
  pledge,
  user: {
    public_name: 'foobar',
    avatar_url: 'https://avatars.githubusercontent.com/u/4314092?s=200&v=4',
  },
  amount: { amount: 800, currency: 'usd' },
  state: 'pending',
}

export const Default: Story = {
  args: {
    rewards: [
      reward,
      {
        ...reward,
        pledge: {
          ...reward.pledge,
          type: 'pay_on_completion',
        },
      },
      {
        ...reward,
        pledge: {
          ...reward.pledge,
          type: 'pay_on_completion',
          state: 'pending',
        },
      },
      {
        ...reward,
        pledge: {
          ...reward.pledge,
          type: 'pay_on_completion',
          state: 'pending',
        },
        state: 'paid',
        paid_at: new Date('2023-08-31').toISOString(),
      },
    ],
    columns: ['PAID_OUT_DATE', 'RECEIVER', 'BACKER', 'PAYMENT_STATUS'],
    title: 'Pledges',
    subtitle: 'Issue',
  },
}
