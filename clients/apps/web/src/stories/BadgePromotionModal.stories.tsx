import type { Meta, StoryObj } from '@storybook/react'

import { BadgePromotionModal } from '@/components/Dashboard/IssuePromotionModal'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'polarkit'
import { IssueDashboardRead, Organization } from 'polarkit/api/client'
import { issueRead, org, repo, user } from './testdata'

type Story = StoryObj<typeof BadgePromotionModal>

interface Issue extends IssueDashboardRead {
  organization?: Organization
}

const dashboardIssue: Issue = {
  ...issueRead,
  funding: {},
  organization: org,
  pledge_badge_currently_embedded: false,
}

const meta: Meta<typeof BadgePromotionModal> = {
  title: 'Organisms/BadgePromotionModal',
  component: BadgePromotionModal,
  tags: ['autodocs'],
  args: {
    repoName: repo.name,
    orgName: org.name,
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
