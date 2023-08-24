import { FundOurBacklog } from '@/components/Embed/FundOurBacklog'
import type { Meta, StoryObj } from '@storybook/react'
import { issue } from './testdata'

const meta: Meta<typeof FundOurBacklog> = {
  title: 'Organisms/FundOurBacklog',
  component: FundOurBacklog,
  // tags: ['autodocs'],
  args: {
    issues: [
      issue,
      {
        ...issue,
        funding: {
          funding_goal: { amount: 500000, currency: 'USD' },
          pledges_sum: { amount: 450000, currency: 'USD' },
        },
        reactions: {
          total_count: 0,
          plus_one: 222,
          minus_one: 0,
          laugh: 0,
          hooray: 0,
          confused: 0,
          heart: 0,
          rocket: 0,
          eyes: 0,
        },
      },
      {
        ...issue,
        title: 'short ❤️',
        funding: {
          funding_goal: undefined,
          pledges_sum: { amount: 40000, currency: 'USD' },
        },
      },
      {
        ...issue,
        title:
          'server/github: Updated badge context and how we generate default',
        funding: {
          funding_goal: { amount: 50000, currency: 'USD' },
          pledges_sum: { amount: 0, currency: 'USD' },
        },
      },
      {
        ...issue,
        reactions: {
          total_count: 0,
          plus_one: 0,
          minus_one: 0,
          laugh: 0,
          hooray: 0,
          confused: 0,
          heart: 0,
          rocket: 0,
          eyes: 0,
        },
      },
    ],
    issueCount: 70,
  },
  parameters: {
    themes: ['light'],
  },
  render: (args) => {
    return (
      <div className="w-fit">
        <FundOurBacklog {...args} />
      </div>
    )
  },
}

export default meta

type Story = StoryObj<typeof FundOurBacklog>

export const Default: Story = {
  args: {},
}

export const TwoIssues: Story = {
  args: {
    issues: [issue, issue],
    issueCount: 2,
  },
}

export const OneIssue: Story = {
  args: {
    issues: [issue],
    issueCount: 1,
  },
}

export const NoIssue: Story = {
  args: {
    issues: [],
    issueCount: 0,
  },
}
