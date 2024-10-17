import type { Meta, StoryObj } from '@storybook/react'

import { PolarQueryClientProvider } from '@/app/providers'
import PublicLayout from '@/components/Layout/PublicLayout'
import { UserContextProvider } from '@/providers/auth'
import { issue, issueBodyHTML, pledger } from '@/utils/testdata'
import ClientPage from './ClientPage'

const meta: Meta<typeof ClientPage> = {
  title: 'Pages/Pledge',
  component: ClientPage,
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

type Story = StoryObj<typeof ClientPage>

export const Default: Story = {
  parameters: {
    chromatic: { viewports: [390, 1200] },
  },

  render: (args) => {
    return (
      <UserContextProvider user={undefined} userOrganizations={[]}>
        <PolarQueryClientProvider>
          <PublicLayout>
            <ClientPage {...args} />
          </PublicLayout>
        </PolarQueryClientProvider>
      </UserContextProvider>
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
        description: null,
        organization: {
          ...issue.repository.organization,
          pretty_name: null,
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
        funding_goal: { currency: 'usd', amount: 15000 },
        pledges_sum: { currency: 'usd', amount: 5000 },
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
          avatar_url: null,
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
          avatar_url: null,
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

export const SplitsZero: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      upfront_split_to_contributors: 0,
    },
  },
}
