import type { Meta, StoryObj } from '@storybook/react'

import { PolarQueryClientProvider } from '@/app/providers'
import PublicLayout from '@/components/Layout/PublicLayout'
import { issue, issueBodyHTML, pledger } from 'polarkit/testdata'
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
      <PolarQueryClientProvider>
        <PublicLayout showUpsellFooter={true}>
          <ClientPage {...args} />
        </PublicLayout>
      </PolarQueryClientProvider>
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

export const PullRequests: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      upfront_split_to_contributors: 75,
    },
    pullRequests: [
      {
        id: 'x',
        number: 123,
        title: 'I am a pull request! Here we gooooooooo!',
        additions: 500,
        deletions: 200,
        is_merged: false,
        is_closed: false,
      },
      {
        id: 'x',
        number: 12322,
        title: 'I am a merged pull request!',
        additions: 500,
        deletions: 200,
        is_merged: true,
        is_closed: true,
        author: {
          login: 'baz',
          html_url: 'x',
          id: 132,
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
        },
      },
      {
        id: 'x',
        number: 12322,
        title: 'I am a closed pull request!',
        additions: 10,
        deletions: 200,
        is_merged: false,
        is_closed: true,
        author: {
          login: 'baz',
          html_url: 'x',
          id: 132,
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
        },
      },
    ],
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
