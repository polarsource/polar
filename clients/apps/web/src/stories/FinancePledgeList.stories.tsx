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
  // pledge: {
  id: 'xx',
  created_at: '2023-06-29',
  // issue_id: 'xx',
  amount: { currency: 'USD', amount: 12300 },
  // repository_id: 'xx',
  // organization_id: 'xx',
  state: PledgeState.CREATED,
  type: PledgeType.PAY_UPFRONT,
  // pledger_name: 'Google',
  // pledger_avatar: 'https://avatars.githubusercontent.com/u/1342004?s=200&v=4',
  // authed_user_can_admin: false,
  scheduled_payout_at: undefined,
  // authed_user_can_admin_sender: false,
  // authed_user_can_admin_received: false,
  issue: issue,
  // },
  // issue: issue,
  // repository: repo,
  // organization: org,
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
    pledges: all_pledge_states,
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
