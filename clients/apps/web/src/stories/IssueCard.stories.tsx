import type { Meta, StoryObj } from '@storybook/react'

import { IssueCard } from 'polarkit/components/pledge'
import { issue } from './testdata'

const meta: Meta<typeof IssueCard> = {
  title: 'Organisms/IssueCard',
  component: IssueCard,
  args: {
    issue: issue,
  },
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof IssueCard>

export const Default: Story = {}

export const FundingGoal: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      funding: {
        funding_goal: { currency: 'USD', amount: 15000 },
        pledges_sum: { currency: 'USD', amount: 5000 },
      },
    },
  },
}

export const FundingGoalZero: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      funding: {
        funding_goal: { currency: 'USD', amount: 15000 },
        pledges_sum: { currency: 'USD', amount: 0 },
      },
    },
  },
}

export const FundingGoalOver: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      funding: {
        funding_goal: { currency: 'USD', amount: 15000 },
        pledges_sum: { currency: 'USD', amount: 30000 },
      },
    },
  },
}

export const FundingGoalPlusCurrent: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      funding: {
        funding_goal: { currency: 'USD', amount: 15000 },
        pledges_sum: { currency: 'USD', amount: 5000 },
      },
    },
    currentPledgeAmount: 800,
  },
}
