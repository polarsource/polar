import type { Meta, StoryObj } from '@storybook/react'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'polarkit'
import {
  ExternalGitHubCommitReference,
  ExternalGitHubPullRequestReference,
  IssueReferenceRead,
  IssueReferenceType,
  IssueStatus,
  PledgeRead,
  PledgeState,
  PledgeType,
  PullRequestReference,
  Reward,
  RewardState,
} from 'polarkit/api/client'
import {
  addDays,
  addHours,
  issue,
  org,
  pledge,
  pledgePublicAPI,
  pledger,
  pledgesSummaries,
  repo,
  user,
} from 'polarkit/testdata'
import IssueListItem from '../components/Dashboard/IssueListItem'

type Story = StoryObj<typeof IssueListItem>

const pledges: PledgeRead[] = [
  {
    id: 'xx',
    created_at: 'what',
    issue_id: 'nah',
    amount: 1234,
    repository_id: 'xx',
    organization_id: 'yy',
    state: PledgeState.CREATED,
    type: PledgeType.PAY_UPFRONT,
    pledger_name: 'zz',
    pledger_avatar: 'https://avatars.githubusercontent.com/u/1426460?v=4',
  },
]

const pledgeDisputable: PledgeRead[] = [
  {
    ...pledges[0],
    state: PledgeState.PENDING,
    type: PledgeType.PAY_UPFRONT,
    scheduled_payout_at: addDays(new Date(), 7).toISOString(),
    authed_user_can_admin: true,
    authed_user_can_admin_sender: true,
  },
]

const pledgeDisputableToday: PledgeRead[] = [
  {
    ...pledges[0],
    state: PledgeState.PENDING,
    type: PledgeType.PAY_UPFRONT,
    scheduled_payout_at: addHours(new Date(), 2).toISOString(),
    authed_user_can_admin: true,
    authed_user_can_admin_sender: true,
  },
]

const pledgeDisputableYesterday: PledgeRead[] = [
  {
    ...pledges[0],
    state: PledgeState.PENDING,
    type: PledgeType.PAY_UPFRONT,
    scheduled_payout_at: addDays(new Date(), -1).toISOString(),
    authed_user_can_admin: true,
    authed_user_can_admin_sender: true,
  },
]

const pledgeDisputed: PledgeRead[] = [
  {
    ...pledges[0],
    state: PledgeState.DISPUTED,
    type: PledgeType.PAY_UPFRONT,
    authed_user_can_admin: true,
    authed_user_can_admin_sender: true,
  },
]

const pledgeDisputedByOther: PledgeRead[] = [
  {
    ...pledges[0],
    state: PledgeState.DISPUTED,
    type: PledgeType.PAY_UPFRONT,
    authed_user_can_admin_received: true,
  },
]

const payload: PullRequestReference = {
  id: '11',
  title: 'Updated Readme.md',
  author_login: '33',
  author_avatar: 'https://avatars.githubusercontent.com/u/47952?v=4',
  number: 55,
  additions: 10,
  deletions: 2,
  state: 'open',
  created_at: '2023-04-08',
  is_draft: false,
}

const references: IssueReferenceRead[] = [
  {
    id: 'wha',
    type: IssueReferenceType.PULL_REQUEST,
    payload,
  },
]

const referencesDraft: IssueReferenceRead[] = [
  {
    id: 'wha',
    type: IssueReferenceType.PULL_REQUEST,
    payload: {
      ...payload,
      is_draft: true,
    },
  },
]

const referencesMerged: IssueReferenceRead[] = [
  {
    id: 'wha',
    type: IssueReferenceType.PULL_REQUEST,
    payload: {
      ...payload,
      //is_draft: true,
      state: 'closed',
      merged_at: '2024-05-01',
    },
  },
]

const referencesClosed: IssueReferenceRead[] = [
  {
    id: 'wha',
    type: IssueReferenceType.PULL_REQUEST,
    payload: {
      ...payload,
      state: 'closed',
      closed_at: '2024-05-01',
    },
  },
]

const doubleReference: IssueReferenceRead[] = [
  {
    id: 'wha',
    type: IssueReferenceType.PULL_REQUEST,
    payload,
  },
  {
    id: 'wha',
    type: IssueReferenceType.PULL_REQUEST,
    payload,
  },
]

const referencesCommit: IssueReferenceRead[] = [
  {
    id: 'wha',
    type: IssueReferenceType.EXTERNAL_GITHUB_COMMIT,
    payload: {
      author_login: 'petterheterjag',
      author_avatar: 'https://avatars.githubusercontent.com/u/1426460?v=4',
      sha: '160a13da0ecedacb326de1b913186f448185ad9a',
      organization_name: 'petterheterjag',
      repository_name: 'polartest',
      message: 'What is this',
      branch_name: 'fix-1234',
    } as ExternalGitHubCommitReference, // with branch name
  },
  {
    id: 'wha',
    type: IssueReferenceType.EXTERNAL_GITHUB_COMMIT,
    payload: {
      author_login: 'petterheterjag',
      author_avatar: 'https://avatars.githubusercontent.com/u/1426460?v=4',
      sha: '160a13da0ecedacb326de1b913186f448185ad9a',
      organization_name: 'petterheterjag',
      repository_name: 'polartest',
      message: 'What is this',
    } as ExternalGitHubCommitReference, // without branch name
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
    repo: {
      options: ['Repo'],
      mapping: {
        Repo: repo,
      },
      defaultValue: repo,
    },
    org: {
      options: ['Org'],
      mapping: {
        Repo: org,
      },
      defaultValue: org,
    },
  },
  args: {
    pledges: pledges,
    references: references,
    repo: repo,
    org: org,
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
        payload: {
          author_login: 'petterheterjag',
          author_avatar: 'https://avatars.githubusercontent.com/u/1426460?v=4',
          sha: '160a13da0ecedacb326de1b913186f448185ad9a',
          organization_name: 'petterheterjag',
          repository_name: 'polartest',
          message: 'What is this',
          branch_name: 'fix-1234',
          title: 'foo',
          number: 23,
          state: 'open',
        } as ExternalGitHubPullRequestReference,
      },
      {
        id: 'wha',
        type: IssueReferenceType.EXTERNAL_GITHUB_PULL_REQUEST,
        payload: {
          author_login: 'petterheterjag',
          author_avatar: 'https://avatars.githubusercontent.com/u/1426460?v=4',
          sha: '160a13da0ecedacb326de1b913186f448185ad9a',
          organization_name: 'petterheterjag',
          repository_name: 'polartest',
          message: 'What is this',
          branch_name: 'fix-1234',
          title: 'foo',
          number: 23,
          state: 'closed',
        } as ExternalGitHubPullRequestReference,
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
      { ...pledgeDisputedByOther[0], amount: 1000 },
      { ...pledgeDisputedByOther[0], amount: 2000 },
      { ...pledgeDisputable[0], amount: 3500 },
      { ...pledgeDisputableYesterday[0], amount: 2200 },
      { ...pledgeDisputableYesterday[0], amount: 10000 },
      { ...pledgeDisputableToday[0], amount: 3800 },
      { ...pledgeDisputableToday[0], amount: 3500 },
      { ...pledgeDisputed[0], amount: 3500 },
      { ...pledgeDisputable[0], amount: 8300 },
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
        ...pledge,
        state: PledgeState.CREATED,
        authed_user_can_admin_received: true,
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
      confirmed_solved_at: addDays(new Date(), -3).toISOString(),
    },
    references: referencesMerged,
    pledges: [
      {
        ...pledge,
        state: PledgeState.PENDING,
        authed_user_can_admin_received: true,
      },
    ],
  },
}

export const PledgeMultipleTypes: Story = {
  args: {
    ...Default.args,
    pledges: [
      {
        ...pledge,
        type: PledgeType.PAY_UPFRONT,
        pledger_avatar: 'https://avatars.githubusercontent.com/u/1426460?v=4',
      },
      {
        ...pledge,
        type: PledgeType.PAY_UPFRONT,
        pledger_avatar: 'https://avatars.githubusercontent.com/u/47952?v=4',
      },
      {
        ...pledge,
        type: PledgeType.PAY_UPFRONT,
        pledger_avatar: 'https://avatars.githubusercontent.com/u/47952?v=4',
      },
      {
        ...pledge,
        type: PledgeType.PAY_UPFRONT,
        pledger_avatar: 'https://avatars.githubusercontent.com/u/47952?v=4',
      },
      {
        ...pledge,
        type: PledgeType.PAY_UPFRONT,
        pledger_avatar: 'https://avatars.githubusercontent.com/u/47952?v=4',
      },
      {
        ...pledge,
        type: PledgeType.PAY_UPFRONT,
        pledger_avatar: 'https://avatars.githubusercontent.com/u/47952?v=4',
      },

      {
        ...pledge,
        type: PledgeType.PAY_ON_COMPLETION,
        pledger_avatar: 'https://avatars.githubusercontent.com/u/1426460?v=4',
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
        payload: {
          ...references[0].payload,
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
        ...pledge,
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
        ...pledge,
        pledger_user_id: user.id,
      },
      {
        ...pledge,
        pledger_user_id: user.id,
      },

      {
        ...pledge,
      },
    ],
    showSelfPledgesFor: user,

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
        ...pledge,
        pledger_user_id: user.id,
      },
      {
        ...pledge,
        pledger_user_id: user.id,
      },

      {
        ...pledge,
      },
    ],
    showSelfPledgesFor: user,

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
          refunded_at: '2023-10-03',
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
