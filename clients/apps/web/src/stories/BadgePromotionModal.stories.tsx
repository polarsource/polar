import type { Meta, StoryObj } from '@storybook/react'

import { BadgePromotionModal } from '@/components/Dashboard/IssuePromotionModal'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'polarkit'
import { IssueDashboardRead, OrganizationPublicRead } from 'polarkit/api/client'
import { issue, org, repo, user } from './testdata'

type Story = StoryObj<typeof BadgePromotionModal>

interface Issue extends IssueDashboardRead {
  organization?: OrganizationPublicRead
}

const dashboardIssue: Issue = {
  ...issue,
  organization: org,
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
