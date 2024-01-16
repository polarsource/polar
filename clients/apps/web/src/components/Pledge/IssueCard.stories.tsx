import type { Meta, StoryObj } from '@storybook/react'

import { issue, issueBodyHTML, pledger, pullRequest } from 'polarkit/testdata'
import IssueCard from './IssueCard'

const meta: Meta<typeof IssueCard> = {
  title: 'Organisms/IssueCard',
  component: IssueCard,
  args: {
    issue: issue,
    htmlBody: issueBodyHTML,
    pledgers: [pledger],
  },
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof IssueCard>

export const Default: Story = {}

export const FundingNoGoal: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      funding: {
        pledges_sum: { currency: 'USD', amount: 5000 },
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

export const FundingGoalZero: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      funding: {
        funding_goal: { currency: 'USD', amount: 15000 },
        pledges_sum: { currency: 'USD', amount: 0 },
      },
    },
  },
}

export const FundingGoalOver: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      funding: {
        funding_goal: { currency: 'USD', amount: 15000 },
        pledges_sum: { currency: 'USD', amount: 30000 },
      },
    },
  },
}

export const FundingGoalPlusCurrent: Story = {
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
    currentPledgeAmount: 800,
  },
}

export const Assigned: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      assignees: [
        {
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          login: 'zegl',
          id: 123,
          html_url: 'x',
        },
        {
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          login: 'zegl',
          id: 123,
          html_url: 'x',
        },
      ],
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

export const UpfrontSplitAssigned: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      upfront_split_to_contributors: 75,
      assignees: [
        {
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          login: 'zegl',
          id: 123,
          html_url: 'x',
        },
        {
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          login: 'zegl',
          id: 123,
          html_url: 'x',
        },
      ],
    },
  },
}

export const UpfrontSplitZero: Story = {
  ...Default,
  args: {
    ...Default.args,
    issue: {
      ...issue,
      upfront_split_to_contributors: 0,
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

export const Rewarded: Story = {
  ...Default,
  args: {
    ...Default.args,
    rewards: {
      receivers: [
        {
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          name: 'zegl',
        },
      ],
    },
    issue: {
      ...issue,
      assignees: [
        {
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          login: 'zegl',
          id: 123,
          html_url: 'x',
        },
        {
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          login: 'zegl',
          id: 123,
          html_url: 'x',
        },
      ],
    },
  },
}

export const RewardedSplit: Story = {
  ...Default,
  args: {
    ...Default.args,
    rewards: {
      receivers: [
        {
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          name: 'zegl',
        },
      ],
    },
    issue: {
      ...issue,
      upfront_split_to_contributors: 75,
      assignees: [
        {
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          login: 'zegl',
          id: 123,
          html_url: 'x',
        },
        {
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          login: 'zegl',
          id: 123,
          html_url: 'x',
        },
      ],
    },
  },
}

export const RewardedSplitPulls: Story = {
  ...Default,
  args: {
    ...Default.args,
    rewards: {
      receivers: [
        {
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          name: 'zegl',
        },
      ],
    },
    issue: {
      ...issue,
      upfront_split_to_contributors: 75,
      assignees: [
        {
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          login: 'zegl',
          id: 123,
          html_url: 'x',
        },
        {
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          login: 'zegl',
          id: 123,
          html_url: 'x',
        },
      ],
    },
    pullRequests: [pullRequest, pullRequest],
  },
}

export const Pulls: Story = {
  ...Default,
  args: {
    ...Default.args,

    issue: {
      ...issue,
    },
    pullRequests: [pullRequest, pullRequest],
  },
}
