import type { Meta, StoryObj } from '@storybook/react'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'polarkit'
import {
  ExternalGitHubCommitReference,
  IssueDashboardRead,
  IssueReferenceRead,
  IssueReferenceType,
  IssueStatus,
  Organization,
  PledgeRead,
  PledgeState,
  PullRequestReference,
} from 'polarkit/api/client'
import { IssueReadWithRelations } from 'polarkit/api/types'
import IssueListItem from '../components/Dashboard/IssueListItem'
import {
  addDays,
  addHours,
  issueRead,
  org,
  pledge,
  repo,
  user,
} from './testdata'

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
    pledger_name: 'zz',
  },
]

const pledgeDisputable: PledgeRead[] = [
  {
    id: 'xx',
    created_at: 'what',
    issue_id: 'nah',
    amount: 1234,
    repository_id: 'xx',
    organization_id: 'yy',
    state: PledgeState.PENDING,
    scheduled_payout_at: addDays(new Date(), 7).toISOString(),
    authed_user_can_admin: true,
    authed_user_can_admin_sender: true,
    pledger_name: 'zz',
  },
]

const pledgeDisputableToday: PledgeRead[] = [
  {
    id: 'xx',
    created_at: 'what',
    issue_id: 'nah',
    amount: 1234,
    repository_id: 'xx',
    organization_id: 'yy',
    state: PledgeState.PENDING,
    scheduled_payout_at: addHours(new Date(), 2).toISOString(),
    authed_user_can_admin: true,
    authed_user_can_admin_sender: true,
    pledger_name: 'zz',
  },
]

const pledgeDisputableYesterday: PledgeRead[] = [
  {
    id: 'xx',
    created_at: 'what',
    issue_id: 'nah',
    amount: 1234,
    repository_id: 'xx',
    organization_id: 'yy',
    state: PledgeState.PENDING,
    scheduled_payout_at: addDays(new Date(), -1).toISOString(),
    authed_user_can_admin: true,
    authed_user_can_admin_sender: true,
    pledger_name: 'zz',
  },
]

const pledgeDisputed: PledgeRead[] = [
  {
    id: 'xx',
    created_at: 'what',
    issue_id: 'nah',
    amount: 1234,
    repository_id: 'xx',
    organization_id: 'yy',
    state: PledgeState.DISPUTED,
    authed_user_can_admin: true,
    authed_user_can_admin_sender: true,
    pledger_name: 'zz',
  },
]

const pledgeDisputedByOther: PledgeRead[] = [
  {
    id: 'xx',
    created_at: 'what',
    issue_id: 'nah',
    amount: 1234,
    repository_id: 'xx',
    organization_id: 'yy',
    state: PledgeState.DISPUTED,
    authed_user_can_admin_received: true,
    pledger_name: 'zz',
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

interface Issue extends IssueDashboardRead {
  organization?: Organization
}

const dashboardIssue: Issue = {
  ...issueRead,
  organization: org,
  funding: {},
  pledge_badge_currently_embedded: false,
}

const issueTriaged = {
  ...dashboardIssue,
  progress: IssueStatus.TRIAGED,
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
const issueInProgress = { ...dashboardIssue, progress: IssueStatus.IN_PROGRESS }
const issuePullRequest = {
  ...dashboardIssue,
  progress: IssueStatus.PULL_REQUEST,
}
const issueClosed = { ...dashboardIssue, progress: IssueStatus.CLOSED }

const dependents: IssueReadWithRelations = {
  ...issueRead,
  number: 123,
  title: "Wow, we're blocked by this thing",
  organization: { ...org, name: 'someorg' },
  repository: { ...repo, name: 'somerepo' },
  references: [],
  pledges: [],
  dependents: [],
  funding: {},
  pledge_badge_currently_embedded: false,
}

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
        Backlog: dashboardIssue,
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
    dependents: {
      options: ['No', 'Yes'],
      mapping: {
        No: [],
        Yes: [dependents],
      },
      defaultValue: [],
    },
  },
  args: {
    pledges: pledges,
    references: references,
    repo: repo,
    org: org,
    issue: dashboardIssue,
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
    references: doubleReference,
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
    issue: issueClosed,
    references: referencesMerged,
    pledges: [
      {
        ...pledge,
        state: PledgeState.CONFIRMATION_PENDING,
        authed_user_can_admin_received: true,
      },
    ],
  },
}

export const PledgeConfirmationPendingConfirmed: Story = {
  args: {
    ...Default.args,
    issue: issueClosed,
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

export const Dependency: Story = {
  args: {
    ...Default.args,
    dependents: [dependents],
  },
}

export const DependencyMultiple: Story = {
  args: {
    ...Default.args,
    dependents: [dependents, dependents, dependents],
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
  },
}

export const SelfSummaryNoGoal: Story = {
  args: {
    ...Default.args,
    issue: {
      ...issueClosed,
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
  },
}
