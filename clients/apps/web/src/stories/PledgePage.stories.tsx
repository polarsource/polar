import type { Meta, StoryObj } from '@storybook/react'

import PublicLayout from '@/components/Layout/PublicLayout'
import { QueryClientProvider, queryClient } from 'polarkit/api'
import { issue, issueBodyHTML, pledger } from 'polarkit/testdata'
import Pledge from '../components/Pledge/Pledge'

const meta: Meta<typeof Pledge> = {
  title: 'Pages/Pledge',
  component: Pledge,
  args: {
    issue: issue,
    htmlBody: issueBodyHTML,
    pledgers: [pledger],
  },
  parameters: {
    nextjs: {
      appDirectory: true,
    },
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
      <QueryClientProvider client={queryClient}>
        <PublicLayout>
          <Pledge {...args} />
        </PublicLayout>
      </QueryClientProvider>
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

export const UpfrontSplit: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      upfront_split_to_contributors: 75,
    },
  },
}

export const Rewards: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      upfront_split_to_contributors: 75,
    },
    rewards: {
      receivers: [
        {
          name: 'foo',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
        {
          name: 'bar',
          avatar_url: 'https://avatars.githubusercontent.com/u/1144727?v=4',
        },

        {
          name: 'Foo Bar',
        },
        {
          name: 'baz',
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
        },
      ],
    },
  },
}

export const Assignees: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      upfront_split_to_contributors: 75,
      assignees: [
        {
          login: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
          html_url: '',
          id: 10053249,
        },
        {
          login: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/1144727?v=4',
          html_url: '',
          id: 1144727,
        },
      ],
    },
  },
}

export const AssigneeAndRewards: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      upfront_split_to_contributors: 75,
      assignees: [
        {
          login: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
          html_url: '',
          id: 10053249,
        },
      ],
    },
    rewards: {
      receivers: [
        {
          name: 'foo',
          avatar_url: 'https://avatars.githubusercontent.com/u/10053249?v=4',
        },
        {
          name: 'bar',
          avatar_url: 'https://avatars.githubusercontent.com/u/1144727?v=4',
        },

        {
          name: 'Foo Bar',
        },
        {
          name: 'baz',
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
        },
      ],
    },
  },
}

export const LongAuthorName: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      author: issue.author
        ? {
            ...issue.author,
            login: 'ASuperLongUsername',
          }
        : undefined,
    },
  },
}
