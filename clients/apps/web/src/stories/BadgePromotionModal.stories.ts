import type { Meta, StoryObj } from '@storybook/react'

import { IssueDashboardRead, OrganizationPublicRead } from 'polarkit/api/client'
import { BadgePromotionModal } from '../components/Dashboard/IssueListItem'
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
}

export default meta

export const Default: Story = {}
