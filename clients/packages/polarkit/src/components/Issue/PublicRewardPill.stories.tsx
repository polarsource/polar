import type { Meta, StoryObj } from '@storybook/react'
import PublicRewardPill from './PublicRewardPill'

const meta: Meta<typeof PublicRewardPill> = {
  title: 'Issue/PublicRewardPill',
  component: PublicRewardPill,
  args: {
    percent: 30,
  },
}

export default meta

type Story = StoryObj<typeof PublicRewardPill>

export const Default: Story = {}
