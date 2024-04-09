import type { Meta, StoryObj } from '@storybook/react'
import FundingPill from './FundingPill'

const meta: Meta<typeof FundingPill> = {
  title: 'Issue/FundingPill',
  component: FundingPill,
  args: {
    total: {
      amount: 25000,
      currency: 'USD',
    },
    goal: {
      amount: 50000,
      currency: 'USD',
    },
  },
}

export default meta

type Story = StoryObj<typeof FundingPill>

export const Default: Story = {}

export const NoGoal: Story = {
  args: {
    ...meta.args,
    goal: undefined,
  },
}
