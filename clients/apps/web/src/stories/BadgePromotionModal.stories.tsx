import type { Meta, StoryObj } from '@storybook/react'

import { PolarQueryClientProvider } from '@/app/providers'
import { BadgePromotionModal } from '@/components/Dashboard/IssuePromotionModal'
import { issue, user } from 'polarkit/testdata'

type Story = StoryObj<typeof BadgePromotionModal>

const meta: Meta<typeof BadgePromotionModal> = {
  title: 'Organisms/BadgePromotionModal',
  component: BadgePromotionModal,
  tags: ['autodocs'],
  args: {
    issue: issue,
    isShown: true,
    toggle: () => {},
    user: user,
  },
  render: (args) => {
    return (
      <PolarQueryClientProvider>
        <BadgePromotionModal {...args} />
      </PolarQueryClientProvider>
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
      ...issue,
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
      ...issue,
      upfront_split_to_contributors: 70,
    },
  },
}

export const RewardsWithSplitZero: Story = {
  ...Default,
  args: {
    ...Default.args,
    defaultTab: 'rewards',
    issue: {
      ...issue,
      upfront_split_to_contributors: 0,
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
