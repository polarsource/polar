import type { Meta, StoryObj } from '@storybook/react'
import FundingPill from './FundingPill'

const meta: Meta<typeof FundingPill> = {
  title: 'Issue/FundingPill',
  component: FundingPill,
  args: {
    total: {
      amount: 25000,
      currency: 'usd',
    },
    goal: {
      amount: 50000,
      currency: 'usd',
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
