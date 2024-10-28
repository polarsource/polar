import type { Meta, StoryObj } from '@storybook/react'

import { PolarQueryClientProvider } from '@/app/providers'
import {
  addDays,
  addHours,
  issue,
  org,
  pledgePublicAPI,
  pledger,
  pledgesSummaries,
  user,
} from '@/utils/testdata'
import {
  Pledge,
  PledgeState,
  PledgeType,
  Reward,
  RewardState,
} from '@polar-sh/sdk'
import IssueListItem from './IssueListItem'

type Story = StoryObj<typeof IssueListItem>

const pledges: Pledge[] = [
  {
    id: 'xx',
    created_at: new Date('2023-10-17').toISOString(),
    modified_at: null,
    issue: issue,
    amount: 1234,
    currency: 'usd',
    state: PledgeState.CREATED,
    type: PledgeType.UPFRONT,
    pledger: {
      name: 'zz',
      avatar_url: 'https://avatars.githubusercontent.com/u/1426460?v=4',
      github_username: 'zz',
    },
  },
]

const pledgeDisputable: Pledge[] = [
  {
    ...pledges[0],
    state: PledgeState.PENDING,
    type: PledgeType.UPFRONT,
    scheduled_payout_at: addDays(new Date(), 7).toISOString(),
    authed_can_admin_sender: true,
  },
]

const pledgeDisputableToday: Pledge[] = [
  {
    ...pledges[0],
    state: PledgeState.PENDING,
    type: PledgeType.UPFRONT,
    scheduled_payout_at: addHours(new Date(), 2).toISOString(),
    authed_can_admin_sender: true,
  },
]

const pledgeDisputableYesterday: Pledge[] = [
  {
    ...pledges[0],
    state: PledgeState.PENDING,
    type: PledgeType.UPFRONT,
    scheduled_payout_at: addDays(new Date(), -1).toISOString(),
    authed_can_admin_sender: true,
  },
]

const pledgeDisputed: Pledge[] = [
  {
    ...pledges[0],
    state: PledgeState.DISPUTED,
    type: PledgeType.UPFRONT,
    authed_can_admin_sender: true,
  },
]

const pledgeDisputedByOther: Pledge[] = [
  {
    ...pledges[0],
    state: PledgeState.DISPUTED,
    type: PledgeType.UPFRONT,
    authed_can_admin_received: true,
  },
]

// TODO(zegl): remove when we enable strict OpenAPI type checking again
const dateConv = (input: Date): string => {
  return input.toISOString()
}

const issueTriaged = {
  ...issue,
  labels: [
    {
      id: 'x',
      name: 'feature',
      color: '112233',
    },
    {
      id: 'x',
      name: 'bug',
      color: '8811111',
    },
  ],
}
const issueInProgress = { ...issue }
const issuePullRequest = { ...issue }
const issueClosed = { ...issue }

const meta: Meta<typeof IssueListItem> = {
  title: 'Organisms/IssueListItem',
  component: IssueListItem,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  argTypes: {
    issue: {
      options: ['Backlog', 'Triaged', 'InProgress', 'PullRequest', 'Closed'],
      mapping: {
        Backlog: issue,
        Triaged: issueTriaged,
        InProgress: issueInProgress,
        PullRequest: issuePullRequest,
        Closed: issueClosed,
      },
      defaultValue: issuePullRequest,
    },
    pledges: {
      options: [
        'None',
        'Yes',
        'Disputable',
        'DisputableToday',
        'PendingPastDispute',
        'DisputedSelf',
        'DisputedOther',
      ],
      mapping: {
        None: [],
        Yes: pledges,
        Disputable: pledgeDisputable,
        DisputableToday: pledgeDisputableToday,
        PendingPastDispute: pledgeDisputableYesterday,
        DisputedSelf: pledgeDisputed,
        DisputedOther: pledgeDisputedByOther,
      },
      defaultValue: pledges,
    },
  },
  args: {
    pledges: pledges,
    issue: issue,
    pledgesSummary: {
      ...pledgesSummaries,
      pay_upfront: {
        ...pledgesSummaries.pay_upfront,
        total: { currency: 'usd', amount: 4000 },
      },
    },
  },
  render: (args) => {
    return (
      <PolarQueryClientProvider>
        <IssueListItem {...args} />
      </PolarQueryClientProvider>
    )
  },
}

export default meta

export const Default: Story = {}

export const StatusTriaged: Story = {
  args: {
    ...Default.args,
    issue: issueTriaged,
  },
}

export const StatusInProgress: Story = {
  args: {
    ...Default.args,
    issue: issueInProgress,
  },
}

export const StatusPullRequest: Story = {
  args: {
    ...Default.args,
    issue: issuePullRequest,
  },
}

export const StatusClosed: Story = {
  args: {
    ...Default.args,
    issue: issueClosed,
  },
}

export const PledgeCanDispute: Story = {
  args: {
    ...Default.args,
    pledges: pledgeDisputable,
  },
}

export const PledgeCanDisputeToday: Story = {
  args: {
    ...Default.args,
    pledges: pledgeDisputableToday,
  },
}

export const PledgeCanDisputeYesterday: Story = {
  args: {
    ...Default.args,
    pledges: pledgeDisputableYesterday,
  },
}

export const PledgeDisputed: Story = {
  args: {
    ...Default.args,
    pledges: pledgeDisputed,
  },
}

export const PledgeDisputedByOther: Story = {
  args: {
    ...Default.args,
    pledges: pledgeDisputedByOther,
  },
}

export const PledgeDisputableMultiple: Story = {
  args: {
    ...Default.args,
    pledges: [
      {
        ...pledgeDisputedByOther[0],
        amount: 1000,
        currency: 'usd',
      },
      {
        ...pledgeDisputedByOther[0],
        amount: 2000,
        currency: 'usd',
      },
      { ...pledgeDisputable[0], amount: 3500, currency: 'usd' },
      {
        ...pledgeDisputableYesterday[0],
        amount: 2200,
        currency: 'usd',
      },
      {
        ...pledgeDisputableYesterday[0],
        amount: 10000,
        currency: 'usd',
      },
      {
        ...pledgeDisputableToday[0],
        amount: 3800,
        currency: 'usd',
      },
      {
        ...pledgeDisputableToday[0],
        amount: 3500,
        currency: 'usd',
      },
      { ...pledgeDisputed[0], amount: 3500, currency: 'usd' },
      { ...pledgeDisputable[0], amount: 8300, currency: 'usd' },
    ],
  },
}

export const PledgeConfirmationPending: Story = {
  args: {
    ...Default.args,
    issue: { ...issueClosed, needs_confirmation_solved: true },
    pledges: [
      {
        ...pledgePublicAPI,
        state: PledgeState.CREATED,
        authed_can_admin_received: true,
      },
    ],
  },
}

export const PledgeConfirmationPendingConfirmed: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
      needs_confirmation_solved: false,
      confirmed_solved_at: dateConv(addDays(new Date(), -3)),
    },
    pledges: [
      {
        ...pledgePublicAPI,
        state: PledgeState.PENDING,
        authed_can_admin_received: true,
      },
    ],
  },
}

export const PledgeMultipleTypes: Story = {
  args: {
    ...Default.args,
    pledges: [
      {
        ...pledgePublicAPI,
        type: PledgeType.UPFRONT,
        pledger: {
          name: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/1426460?v=4',
          github_username: 'xx',
        },
      },
      {
        ...pledgePublicAPI,
        type: PledgeType.UPFRONT,
        pledger: {
          name: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          github_username: 'xx',
        },
      },
      {
        ...pledgePublicAPI,
        type: PledgeType.UPFRONT,
        pledger: {
          name: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          github_username: 'xx',
        },
      },
      {
        ...pledgePublicAPI,
        type: PledgeType.UPFRONT,
        pledger: {
          name: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          github_username: 'xx',
        },
      },
      {
        ...pledgePublicAPI,
        type: PledgeType.UPFRONT,
        pledger: {
          name: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          github_username: 'xx',
        },
      },
      {
        ...pledgePublicAPI,
        type: PledgeType.UPFRONT,
        pledger: {
          name: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
          github_username: 'xx',
        },
      },

      {
        ...pledgePublicAPI,
        type: PledgeType.ON_COMPLETION,
        pledger: {
          name: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/1426460?v=4',
          github_username: 'xx',
        },
      },
    ],
  },
}

export const StatusPullRequestNameHighlights: Story = {
  args: {
    ...Default.args,
    issue: { ...issuePullRequest, title: ' `IsInstance` type annotation' },
  },
}

export const FundingGoal: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
      funding: {
        funding_goal: { currency: 'usd', amount: 60000 },
      },
    },
    pledges: [
      {
        ...pledgePublicAPI,
      },
    ],
  },
}

export const SelfSummaryFundingGoal: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
      funding: {
        funding_goal: { currency: 'usd', amount: 60000 },
      },
    },
    pledges: [
      {
        ...pledgePublicAPI,
        pledger: {
          name: user.email,
          github_username: 'test',
          avatar_url: user.avatar_url,
        },
        authed_can_admin_sender: true,
      },
      {
        ...pledgePublicAPI,
        pledger: {
          name: user.email,
          github_username: 'test',
          avatar_url: user.avatar_url,
        },
        authed_can_admin_sender: true,
      },
      {
        ...pledgePublicAPI,
      },
    ],

    pledgesSummary: {
      ...pledgesSummaries,
      pay_upfront: {
        total: { currency: 'usd', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
      pay_on_completion: {
        total: { currency: 'usd', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
    },
  },
}

export const SelfSummaryNoGoal: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
      upfront_split_to_contributors: 90,
    },
    pledges: [
      {
        ...pledgePublicAPI,
        pledger: {
          name: user.email,
          github_username: 'test',
          avatar_url: user.avatar_url,
        },
        authed_can_admin_sender: true,
      },
      {
        ...pledgePublicAPI,
        pledger: {
          name: 'BigCo',
          github_username: 'polarsource',
          avatar_url:
            'https://avatars.githubusercontent.com/u/13629408?s=200&v=4',
        },
        authed_can_admin_sender: true,
      },
      {
        ...pledgePublicAPI,
        pledger: {
          name: user.email,
          github_username: 'test',
          avatar_url: user.avatar_url,
        },
        authed_can_admin_sender: true,
      },

      {
        ...pledgePublicAPI,
      },
    ],

    pledgesSummary: {
      ...pledgesSummaries,
      pay_upfront: {
        total: { currency: 'usd', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
      pay_on_completion: {
        total: { currency: 'usd', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
    },
  },
}

export const OrganizationPledgeWithCreatedBy: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
    },
    pledges: [
      {
        ...pledgePublicAPI,
        pledger: {
          name: org.slug,
          github_username: org.slug,
          avatar_url: org.avatar_url,
        },
        authed_can_admin_sender: true,
        created_by: {
          name: user.email,
          github_username: 'test',
          avatar_url: user.avatar_url,
        },
      },
    ],
  },
}

export const OrganizationPledgeWithInvoice: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
    },
    pledges: [
      {
        ...pledgePublicAPI,
        pledger: {
          name: org.slug,
          github_username: org.slug,
          avatar_url: org.avatar_url,
        },
        authed_can_admin_sender: true,
        created_by: {
          name: user.email,
          github_username: 'test',
          avatar_url: user.avatar_url,
        },
        hosted_invoice_url: 'http://example.com/',
      },
      {
        ...pledgePublicAPI,
        pledger: {
          name: org.slug,
          github_username: org.slug,
          avatar_url: org.avatar_url,
        },
        authed_can_admin_sender: true,
        created_by: {
          name: user.email,
          github_username: 'test',
          avatar_url: user.avatar_url,
        },
        hosted_invoice_url: 'http://example.com/',
        state: PledgeState.PENDING, // paid
      },
    ],
  },
}

export const PublicReward: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
      upfront_split_to_contributors: 90,
    },
    pledgesSummary: pledgesSummaries,
  },
}

const reward: Reward = {
  pledge: pledgePublicAPI,
  state: RewardState.PENDING,
  amount: { currency: 'usd', amount: 4000 },
}

export const RewardsStatusAll: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
      upfront_split_to_contributors: 90,
      funding: {
        pledges_sum: { amount: 8000, currency: 'usd' },
      },
    },
    pledgesSummary: {
      ...pledgesSummaries,
      pay_upfront: {
        total: { currency: 'usd', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
      pay_on_completion: {
        total: { currency: 'usd', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
    },

    rewards: [
      {
        ...reward,
        state: RewardState.PENDING,

        amount: { currency: 'usd', amount: 1000 },
      },
      {
        ...reward,
        state: RewardState.PAID,
        amount: { currency: 'usd', amount: 2000 },
      },
      {
        ...reward,
        state: RewardState.PENDING,
        amount: { currency: 'usd', amount: 3000 },
        pledge: {
          ...reward.pledge,
          refunded_at: dateConv(new Date('2023-10-03')),
        },
      },
    ],
  },
}

export const RewardsStatusPaidOnly: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
      upfront_split_to_contributors: 90,
      funding: {
        pledges_sum: { amount: 8000, currency: 'usd' },
      },
    },

    pledgesSummary: {
      ...pledgesSummaries,
      pay_upfront: {
        total: { currency: 'usd', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
      pay_on_completion: {
        total: { currency: 'usd', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
    },

    rewards: [
      {
        ...reward,
        state: RewardState.PAID,
        amount: { currency: 'usd', amount: 2000 },
      },
    ],
  },
}

export const RewardsStatusPaidOnlyZero: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
      upfront_split_to_contributors: 0,
      funding: {
        pledges_sum: { amount: 8000, currency: 'usd' },
      },
    },

    pledgesSummary: {
      ...pledgesSummaries,
      pay_upfront: {
        total: { currency: 'usd', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
      pay_on_completion: {
        total: { currency: 'usd', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
    },

    rewards: [
      {
        ...reward,
        state: RewardState.PAID,
        amount: { currency: 'usd', amount: 2000 },
      },
    ],
  },
}
