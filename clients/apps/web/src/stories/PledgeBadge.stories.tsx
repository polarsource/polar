import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from 'polarkit/components/badge'

const meta: Meta<typeof Badge> = {
  title: 'Organisms/PledgeBadge',
  component: Badge,
  tags: ['autodocs'],
  args: {
    showAmountRaised: false,
  },
  parameters: {
    themes: ['light'],
  },
}

export default meta

type Story = StoryObj<typeof Badge>

export const Default: Story = {
  args: {},
}

export const AmountRaised: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      pledges_sum: { currency: 'USD', amount: 5000 },
    },
  },
}

export const LargeAmountRaised: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      pledges_sum: { currency: 'USD', amount: 800000 },
    },
  },
}

export const FundingGoal: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      funding_goal: { currency: 'USD', amount: 12000 },
      pledges_sum: { currency: 'USD', amount: 6000 },
    },
  },
}

export const FundingGoalZero: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      funding_goal: { currency: 'USD', amount: 12000 },
      pledges_sum: { currency: 'USD', amount: 0 },
    },
  },
}

export const FundingGoalOver: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      funding_goal: { currency: 'USD', amount: 12000 },
      pledges_sum: { currency: 'USD', amount: 3000000 },
    },
  },
}
