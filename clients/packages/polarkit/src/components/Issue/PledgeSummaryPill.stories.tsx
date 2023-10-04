import { Pledger } from '@/api/client'
import type { Meta, StoryObj } from '@storybook/react'
import PledgeSummaryPill from './PledgeSummaryPill'

const pledger: Pledger = {
  name: 'zegl',
  github_username: 'zegl',
  avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
}

const meta: Meta<typeof PledgeSummaryPill.Funded> = {
  title: 'Issue/PledgeSummaryPill',
  args: {
    summary: {
      pledgers: [pledger, pledger, pledger],
      total: {
        amount: 25000,
        currency: 'USD',
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof PledgeSummaryPill.Funded>

export const Funded: Story = {
  render: (args) => {
    return <PledgeSummaryPill.Funded {...args} />
  },
}

export const Pledged: Story = {
  render: (args) => {
    return <PledgeSummaryPill.Pledged {...args} />
  },
}
