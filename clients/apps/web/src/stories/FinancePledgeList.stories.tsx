import type { Meta, StoryObj } from '@storybook/react'

import List, { Column } from '@/components/Finance/ListPledges'
import { Pledge, PledgeState, PledgeType } from 'polarkit/api/client'
import { issue } from './testdata'

type Story = StoryObj<typeof List>

const meta: Meta<typeof List> = {
  title: 'Organisms/FinancePledgeList',
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

export const Default: Story = {
  args: {
    pledges: [
      ...all_pledge_states,
      {
        ...pledge,
        issue: {
          ...pledge.issue,
          title: `with pledger name`,
        },
        pledger: {
          name: 'Mr. Money',
        },
      },
      {
        ...pledge,
        issue: {
          ...pledge.issue,
          title: `with pledger name and avatar`,
        },
        pledger: {
          name: 'Mr. Money',
          avatar_url:
            'https://avatars.githubusercontent.com/u/1525981?s=200&v=4',
        },
      },
      {
        ...pledge,
        type: PledgeType.PAY_ON_COMPLETION,
        issue: {
          ...pledge.issue,
          title: `PAY_ON_COMPLETION`,
        },
        pledger: {
          name: 'Mr. Money',
          avatar_url:
            'https://avatars.githubusercontent.com/u/1525981?s=200&v=4',
        },
      },
    ],
    columns: [],
    title: 'Pledges',
    subtitle: 'Issue',
  },
}

export const InReview: Story = {
  args: {
    ...Default.args,
    pledges: [
      {
        ...pledge,
        state: PledgeState.PENDING,
        scheduled_payout_at: '2023-07-14',
      },
      {
        ...pledge,
        state: PledgeState.PENDING,
      },
    ],
    columns: ['ESTIMATED_PAYOUT_DATE' as Column],
  },
}

export const Refunded: Story = {
  args: {
    ...Default.args,
    pledges: [
      {
        ...pledge,
        state: PledgeState.REFUNDED,
        scheduled_payout_at: '2023-07-14',
      },
    ],
    columns: ['REFUNDED_DATE'],
  },
}
