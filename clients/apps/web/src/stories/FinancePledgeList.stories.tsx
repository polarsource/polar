import type { Meta, StoryObj } from '@storybook/react'

import List, { Column } from '@/components/Finance/ListPledges'
import { issue } from '@/utils/testdata'
import { Pledge, PledgeState, PledgeType } from '@polar-sh/sdk'

type Story = StoryObj<typeof List>

const meta: Meta<typeof List> = {
  title: 'Organisms/FinancePledgeList',
  component: List,
  tags: ['autodocs'],
}

export default meta

const pledge: Pledge = {
  id: 'xx',
  created_at: new Date('2023-06-29').toISOString(),
  modified_at: null,
  amount: 12300,
  currency: 'usd',
  state: PledgeState.CREATED,
  type: PledgeType.UPFRONT,
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
          avatar_url: null,
          github_username: null,
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
          github_username: null,
        },
      },
      {
        ...pledge,
        type: PledgeType.ON_COMPLETION,
        issue: {
          ...pledge.issue,
          title: `PAY_ON_COMPLETION`,
        },
        pledger: {
          name: 'Mr. Money',
          avatar_url:
            'https://avatars.githubusercontent.com/u/1525981?s=200&v=4',
          github_username: null,
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
        scheduled_payout_at: new Date('2023-07-14').toISOString(),
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
        scheduled_payout_at: new Date('2023-07-14').toISOString(),
      },
    ],
    columns: ['REFUNDED_DATE'],
  },
}
