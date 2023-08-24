import type { Meta, StoryObj } from '@storybook/react'

import PublicLayout from '@/components/Layout/PublicLayout'
import Pledge from '../components/Pledge/Pledge'
import { issue } from './testdata'

const meta: Meta<typeof Pledge> = {
  title: 'Pages/Pledge',
  component: Pledge,
  args: {
    issue: issue,
  },
}

export default meta

type Story = StoryObj<typeof Pledge>

export const Default: Story = {
  parameters: {
    chromatic: { viewports: [390, 1200] },
  },

  render: (args) => {
    return (
      <PublicLayout>
        <Pledge {...args} />
      </PublicLayout>
    )
  },
}

export const NoNameDescription: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      repository: {
        ...issue.repository,
        description: undefined,
        organization: {
          ...issue.repository.organization,
          pretty_name: undefined,
        },
      },
    },
  },
}

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
