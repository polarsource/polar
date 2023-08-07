import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from 'polarkit/components/badge'

const meta: Meta<typeof Badge> = {
  title: 'Organisms/PledgeBadge',
  component: Badge,
  tags: ['autodocs'],
  args: {
    showAmountRaised: false,
    amountRaised: '3000',
  },
  parameters: {
    themes: ['light'],
  },
}

export default meta

type Story = StoryObj<typeof Badge>

export const Default: Story = {
  args: {
    // amount: 123000,
  },
}

export const AmountRaised: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    amountRaised: '50',
  },
}

export const FundingGoal: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    amountRaised: '50',
    funding: {
      funding_goal: { currency: 'USD', amount: 12000 },
      pledges_sum: { currency: 'USD', amount: 6000 },
    },
  },
}
