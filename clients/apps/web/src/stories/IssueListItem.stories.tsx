import type { Meta, StoryObj } from '@storybook/react'

import {
  IssueReferenceRead,
  IssueReferenceType,
  IssueStatus,
  Pledge,
  PledgeState,
  PledgeType,
  PullRequestReference,
  Reward,
  RewardState,
} from '@polar-sh/sdk'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'polarkit'
import {
  addDays,
  addHours,
  issue,
  pledgePublicAPI,
  pledger,
  pledgesSummaries,
  user,
} from 'polarkit/testdata'
import IssueListItem from '../components/Dashboard/IssueListItem'

type Story = StoryObj<typeof IssueListItem>

const pledges: Pledge[] = [
  {
    id: 'xx',
    created_at: new Date('2023-10-17').toISOString(),
    issue: issue,
    amount: { currency: 'USD', amount: 1234 },
    state: PledgeState.CREATED,
    type: PledgeType.UPFRONT,
    pledger: {
      name: 'zz',
      avatar_url: 'https://avatars.githubusercontent.com/u/1426460?v=4',
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

// urgh!
const dummyPayload = {
  id: '',
  title: '',
  author_login: '',
  author_avatar: '',
  number: 0,
  additions: 0,
  deletions: 0,
  state: '',
  created_at: dateConv(new Date()),
  is_draft: false,
  organization_name: '',
  repository_name: '',
  sha: '',
}

const pullRequestReference: PullRequestReference = {
  id: '11',
  title: 'Updated Readme.md',
  author_login: '33',
  author_avatar: 'https://avatars.githubusercontent.com/u/47952?v=4',
  number: 55,
  additions: 10,
  deletions: 2,
  state: 'open',
  created_at: dateConv(new Date('2023-04-08')),
  is_draft: false,
}

const references: IssueReferenceRead[] = [
  {
    id: 'wha',
    type: IssueReferenceType.PULL_REQUEST,
    payload: dummyPayload,
    pull_request_reference: pullRequestReference,
  },
]

const referencesDraft: IssueReferenceRead[] = [
  {
    id: 'wha',
    type: IssueReferenceType.PULL_REQUEST,
    payload: dummyPayload,
    pull_request_reference: {
      ...pullRequestReference,
      is_draft: true,
    },
  },
]

const referencesMerged: IssueReferenceRead[] = [
  {
    id: 'wha',
    type: IssueReferenceType.PULL_REQUEST,
    payload: dummyPayload,
    pull_request_reference: {
      ...pullRequestReference,
      //is_draft: true,
      state: 'closed',
      merged_at: dateConv(new Date('2024-05-01')),
    },
  },
]

const referencesClosed: IssueReferenceRead[] = [
  {
    id: 'wha',
    type: IssueReferenceType.PULL_REQUEST,
    payload: dummyPayload,
    pull_request_reference: {
      ...pullRequestReference,
      state: 'closed',
      closed_at: dateConv(new Date('2024-05-01')),
    },
  },
]

const doubleReference: IssueReferenceRead[] = [
  {
    id: 'wha',
    type: IssueReferenceType.PULL_REQUEST,
    payload: dummyPayload,
    pull_request_reference: {
      ...pullRequestReference,
    },
  },
  {
    id: 'wha',
    type: IssueReferenceType.PULL_REQUEST,
    payload: dummyPayload,
    pull_request_reference: {
      ...pullRequestReference,
    },
  },
]

const referencesCommit: IssueReferenceRead[] = [
  {
    id: 'wha',
    type: IssueReferenceType.EXTERNAL_GITHUB_COMMIT,
    payload: dummyPayload,
    external_github_commit_reference: {
      author_login: 'petterheterjag',
      author_avatar: 'https://avatars.githubusercontent.com/u/1426460?v=4',
      sha: '160a13da0ecedacb326de1b913186f448185ad9a',
      organization_name: 'petterheterjag',
      repository_name: 'polartest',
      message: 'What is this',
      branch_name: 'fix-1234',
    }, // with branch name
  },
  {
    id: 'wha',
    type: IssueReferenceType.EXTERNAL_GITHUB_COMMIT,
    payload: dummyPayload,
    external_github_commit_reference: {
      author_login: 'petterheterjag',
      author_avatar: 'https://avatars.githubusercontent.com/u/1426460?v=4',
      sha: '160a13da0ecedacb326de1b913186f448185ad9a',
      organization_name: 'petterheterjag',
      repository_name: 'polartest',
      message: 'What is this',
    }, // without branch name
  },
]

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
const issueInProgress = { ...issue, progress: IssueStatus.IN_PROGRESS }
const issuePullRequest = {
  ...issue,
  progress: IssueStatus.PULL_REQUEST,
}
const issueClosed = { ...issue, progress: IssueStatus.CLOSED }

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
    references: {
      options: ['None', 'Draft', 'OpenPR', 'MergedPR', 'ClosedPR', 'Commits'],
      mapping: {
        None: [],
        Draft: referencesDraft,
        OpenPR: references,
        MergedPR: referencesMerged,
        ClosedPR: referencesClosed,
        Commits: referencesCommit,
      },
      defaultValue: pledges,
    },
  },
  args: {
    pledges: pledges,
    references: references,
    issue: issue,
    pledgesSummary: {
      ...pledgesSummaries,
      pay_upfront: {
        ...pledgesSummaries.pay_upfront,
        total: { currency: 'USD', amount: 4000 },
      },
    },
  },
  render: (args) => {
    return (
      <QueryClientProvider client={queryClient}>
        <IssueListItem {...args} />
      </QueryClientProvider>
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
    references: referencesDraft,
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
    references: referencesMerged,
    issue: issueClosed,
  },
}

export const TwoReferences: Story = {
  args: {
    ...Default.args,
    pledges: [],
    references: doubleReference,
  },
}

export const AllReferences: Story = {
  args: {
    ...Default.args,
    pledges: [],
    references: [
      ...doubleReference,
      ...referencesDraft,
      ...references,
      ...referencesMerged,
      ...referencesClosed,
      ...referencesCommit,
      {
        id: 'wha',
        type: IssueReferenceType.EXTERNAL_GITHUB_PULL_REQUEST,
        payload: dummyPayload,
        external_github_pull_request_reference: {
          author_login: 'petterheterjag',
          author_avatar: 'https://avatars.githubusercontent.com/u/1426460?v=4',
          organization_name: 'petterheterjag',
          repository_name: 'polartest',
          title: 'foo',
          number: 23,
          state: 'open',
        },
      },
      {
        id: 'wha',
        type: IssueReferenceType.EXTERNAL_GITHUB_PULL_REQUEST,
        payload: dummyPayload,
        external_github_pull_request_reference: {
          author_login: 'petterheterjag',
          author_avatar: 'https://avatars.githubusercontent.com/u/1426460?v=4',
          organization_name: 'petterheterjag',
          repository_name: 'polartest',
          title: 'foo',
          number: 23,
          state: 'closed',
        },
      },
    ],
  },
}

export const ReferencesNoPledge: Story = {
  args: {
    ...Default.args,
    pledges: [],
    references: doubleReference,
  },
}

export const ReferencesCommit: Story = {
  args: {
    ...Default.args,
    references: referencesCommit,
  },
}

export const PledgeNoReferences: Story = {
  args: {
    ...Default.args,
    references: [],
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
        amount: { currency: 'USD', amount: 1000 },
      },
      {
        ...pledgeDisputedByOther[0],
        amount: { currency: 'USD', amount: 2000 },
      },
      { ...pledgeDisputable[0], amount: { currency: 'USD', amount: 3500 } },
      {
        ...pledgeDisputableYesterday[0],
        amount: { currency: 'USD', amount: 2200 },
      },
      {
        ...pledgeDisputableYesterday[0],
        amount: { currency: 'USD', amount: 10000 },
      },
      {
        ...pledgeDisputableToday[0],
        amount: { currency: 'USD', amount: 3800 },
      },
      {
        ...pledgeDisputableToday[0],
        amount: { currency: 'USD', amount: 3500 },
      },
      { ...pledgeDisputed[0], amount: { currency: 'USD', amount: 3500 } },
      { ...pledgeDisputable[0], amount: { currency: 'USD', amount: 8300 } },
    ],
  },
}

export const PledgeConfirmationPending: Story = {
  args: {
    ...Default.args,
    issue: { ...issueClosed, needs_confirmation_solved: true },
    references: referencesMerged,
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
    references: referencesMerged,
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
        },
      },
      {
        ...pledgePublicAPI,
        type: PledgeType.UPFRONT,
        pledger: {
          name: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
        },
      },
      {
        ...pledgePublicAPI,
        type: PledgeType.UPFRONT,
        pledger: {
          name: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
        },
      },
      {
        ...pledgePublicAPI,
        type: PledgeType.UPFRONT,
        pledger: {
          name: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
        },
      },
      {
        ...pledgePublicAPI,
        type: PledgeType.UPFRONT,
        pledger: {
          name: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
        },
      },
      {
        ...pledgePublicAPI,
        type: PledgeType.UPFRONT,
        pledger: {
          name: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
        },
      },

      {
        ...pledgePublicAPI,
        type: PledgeType.ON_COMPLETION,
        pledger: {
          name: 'xx',
          avatar_url: 'https://avatars.githubusercontent.com/u/1426460?v=4',
        },
      },
    ],
  },
}

export const StatusPullRequestNameHighlights: Story = {
  args: {
    ...Default.args,
    issue: { ...issuePullRequest, title: ' `IsInstance` type annotation' },
    references: [
      {
        ...references[0],
        pull_request_reference: {
          ...pullRequestReference,
          title: 'Wow! `Highlight!`',
        },
      },
    ],
  },
}

export const FundingGoal: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
      funding: {
        funding_goal: { currency: 'USD', amount: 60000 },
      },
    },
    references: referencesMerged,
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
        funding_goal: { currency: 'USD', amount: 60000 },
      },
    },
    references: referencesMerged,
    pledges: [
      {
        ...pledgePublicAPI,
        pledger: {
          name: user.username,
          github_username: user.username,
          avatar_url: user.avatar_url,
        },
        authed_can_admin_sender: true,
      },
      {
        ...pledgePublicAPI,
        pledger: {
          name: user.username,
          github_username: user.username,
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
        total: { currency: 'USD', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
      pay_on_completion: {
        total: { currency: 'USD', amount: 4000 },
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
    references: referencesMerged,
    pledges: [
      {
        ...pledgePublicAPI,
        pledger: {
          name: user.username,
          github_username: user.username,
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
          name: user.username,
          github_username: user.username,
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
        total: { currency: 'USD', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
      pay_on_completion: {
        total: { currency: 'USD', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
    },
  },
}

export const PublicReward: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
      upfront_split_to_contributors: 90,
    },
    references: [],
    pledgesSummary: pledgesSummaries,
  },
}

const reward: Reward = {
  pledge: pledgePublicAPI,
  state: RewardState.PENDING,
  amount: { currency: 'USD', amount: 4000 },
}

export const RewardsStatusAll: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
      upfront_split_to_contributors: 90,
      funding: {
        pledges_sum: { amount: 8000, currency: 'USD' },
      },
    },
    references: [],

    pledgesSummary: {
      ...pledgesSummaries,
      pay_upfront: {
        total: { currency: 'USD', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
      pay_on_completion: {
        total: { currency: 'USD', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
    },

    rewards: [
      {
        ...reward,
        state: RewardState.PENDING,

        amount: { currency: 'USD', amount: 1000 },
      },
      {
        ...reward,
        state: RewardState.PAID,
        amount: { currency: 'USD', amount: 2000 },
      },
      {
        ...reward,
        state: RewardState.PENDING,
        amount: { currency: 'USD', amount: 3000 },
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
        pledges_sum: { amount: 8000, currency: 'USD' },
      },
    },
    references: [],

    pledgesSummary: {
      ...pledgesSummaries,
      pay_upfront: {
        total: { currency: 'USD', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
      pay_on_completion: {
        total: { currency: 'USD', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
    },

    rewards: [
      {
        ...reward,
        state: RewardState.PAID,
        amount: { currency: 'USD', amount: 2000 },
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
        pledges_sum: { amount: 8000, currency: 'USD' },
      },
    },
    references: [],

    pledgesSummary: {
      ...pledgesSummaries,
      pay_upfront: {
        total: { currency: 'USD', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
      pay_on_completion: {
        total: { currency: 'USD', amount: 4000 },
        pledgers: [pledger, pledger, pledger],
      },
    },

    rewards: [
      {
        ...reward,
        state: RewardState.PAID,
        amount: { currency: 'USD', amount: 2000 },
      },
    ],
  },
}
