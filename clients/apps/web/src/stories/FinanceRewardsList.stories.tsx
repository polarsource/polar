import type { Meta, StoryObj } from '@storybook/react'

import List from '@/components/Finance/ListRewards'
import {
  Pledge,
  PledgeState,
  PledgeType,
  Reward,
  RewardState,
} from 'polarkit/api/client'
import { issue } from './testdata'

type Story = StoryObj<typeof List>

const meta: Meta<typeof List> = {
  title: 'Organisms/FinanceRewardsList',
  component: List,
  tags: ['autodocs'],
}

export default meta

const pledge: Pledge = {
  id: 'xx',
  created_at: '2023-06-29',
  amount: { currency: 'USD', amount: 12300 },
  state: PledgeState.CREATED,
  type: PledgeType.PAY_UPFRONT,
  scheduled_payout_at: undefined,
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

const reward: Reward = {
  pledge,
  user: {
    username: 'foobar',
    avatar_url: 'https://avatars.githubusercontent.com/u/4314092?s=200&v=4',
  },
  amount: { amount: 800, currency: 'USD' },
  state: RewardState.PENDING,
}

export const Default: Story = {
  args: {
    rewards: [
      reward,
      {
        ...reward,
        pledge: {
          ...reward.pledge,
          type: PledgeType.PAY_ON_COMPLETION,
        },
      },
      {
        ...reward,
        pledge: {
          ...reward.pledge,
          type: PledgeType.PAY_ON_COMPLETION,
          state: PledgeState.PENDING,
        },
      },
      {
        ...reward,
        pledge: {
          ...reward.pledge,
          type: PledgeType.PAY_ON_COMPLETION,
          state: PledgeState.PENDING,
        },
        state: RewardState.PAID,
        paid_at: '2023-08-31',
      },
    ],
    columns: ['ESTIMATED_PAYOUT_DATE', 'PAID_OUT_DATE', 'RECEIVER'],
    title: 'Pledges',
    subtitle: 'Issue',
  },
}
