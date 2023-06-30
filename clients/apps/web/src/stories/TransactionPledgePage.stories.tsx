import type { Meta, StoryObj } from '@storybook/react'

import Transactions from '@/components/Dashboard/Transactions/Transactions'
import { PledgeResources, PledgeState } from 'polarkit/api/client'
import { issue, org, orgPrivate, repo } from './testdata'

type Story = StoryObj<typeof Transactions>

const meta: Meta<typeof Transactions> = {
  title: 'Pages/Transactions',
  component: Transactions,
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
        title: `${issue.title} (${s})`,
      },
    }
  },
)

export const Default: Story = {
  args: {
    pledges: all_pledge_states,
    org: orgPrivate,
    tab: 'current',
  },
}

export const Rewarded: Story = {
  args: {
    pledges: all_pledge_states,
    org: orgPrivate,
    tab: 'rewarded',
  },
}

export const Dark: Story = {
  args: {
    pledges: all_pledge_states,
    org: orgPrivate,
    tab: 'current',
  },
  parameters: {
    themes: ['dark'],
  },
}
