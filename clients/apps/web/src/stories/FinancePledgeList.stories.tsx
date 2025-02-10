import type { Meta, StoryObj } from '@storybook/react'

import List, { Column } from '@/components/Finance/ListPledges'
import { issue } from '@/utils/testdata'
import { components } from '@polar-sh/client'

type Story = StoryObj<typeof List>

const meta: Meta<typeof List> = {
  title: 'Organisms/FinancePledgeList',
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

let all_pledge_states: components['schemas']['Pledge'][] = [
  'initiated',
  'created',
  'pending',
  'refunded',
  'disputed',
  'charge_disputed',
  'cancelled',
].map((s): components['schemas']['Pledge'] => {
  return {
    ...pledge,
    state: s as components['schemas']['PledgeState'],
    issue: {
      ...pledge.issue,
      title: `${pledge.issue.title} (${s})`,
    },
  }
})

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
        type: 'pay_on_completion',
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
        state: 'pending',
        scheduled_payout_at: new Date('2023-07-14').toISOString(),
      },
      {
        ...pledge,
        state: 'pending',
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
        state: 'refunded',
        scheduled_payout_at: new Date('2023-07-14').toISOString(),
      },
    ],
    columns: ['REFUNDED_DATE'],
  },
}
