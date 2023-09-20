import type { Meta, StoryObj } from '@storybook/react'

import { BadgePromotionModal } from '@/components/Dashboard/IssuePromotionModal'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'polarkit'
import {
  Issue,
  IssueDashboardRead,
  Organization,
  State,
} from 'polarkit/api/client'
import { issue, org, repo, user } from './testdata'

type Story = StoryObj<typeof BadgePromotionModal>

interface DashIssue extends IssueDashboardRead {
  organization?: Organization
}

const dashboardIssue: DashIssue = {
  ...issue,
  organization_id: issue.repository.organization.id,
  repository_id: issue.repository.id,
  state: issue.state == Issue.state.OPEN ? State.OPEN : State.CLOSED,
  funding: {},
  organization: org,
  pledge_badge_currently_embedded: false,
  needs_confirmation_solved: false,
}

const meta: Meta<typeof BadgePromotionModal> = {
  title: 'Organisms/BadgePromotionModal',
  component: BadgePromotionModal,
  tags: ['autodocs'],
  args: {
    repo: repo,
    org: org,
    issue: dashboardIssue,
    isShown: true,
    toggle: () => {},
    user: user,
  },
  render: (args) => {
    return (
      <QueryClientProvider client={queryClient}>
        <BadgePromotionModal {...args} />
      </QueryClientProvider>
    )
  },
}

export default meta

export const Default: Story = {}

export const FundingGoal: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...dashboardIssue,
      funding: {
        funding_goal: { currency: 'USD', amount: 123000 },
        pledges_sum: { currency: 'USD', amount: 8000 },
      },
    },
  },
}

export const Rewards: Story = {
  ...Default,
  args: {
    ...Default.args,
    defaultTab: 'rewards',
  },
}

export const RewardsWithSplit: Story = {
  ...Default,
  args: {
    ...Default.args,
    defaultTab: 'rewards',
    issue: {
      ...dashboardIssue,
      upfront_split_to_contributors: 70,
    },
  },
}

export const Promote: Story = {
  ...Default,
  args: {
    ...Default.args,
    defaultTab: 'promote',
  },
}
