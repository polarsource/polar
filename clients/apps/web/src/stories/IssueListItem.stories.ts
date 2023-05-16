import type { Meta, StoryObj } from '@storybook/react'

import {
  IssueDashboardRead,
  IssueReferenceRead,
  IssueReferenceType,
  OrganizationPublicRead,
  Platforms,
  PledgeRead,
  PledgeState,
  PullRequestReference,
  RepositoryRead,
  State,
  Visibility,
} from 'polarkit/api/client'
import IssueListItem from '../components/Dashboard/IssueListItem'

const meta: Meta<typeof IssueListItem> = {
  title: 'IssueListItem',
  component: IssueListItem,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ['autodocs'],
  argTypes: {},
}

export default meta

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

const org: OrganizationPublicRead = {
  id: 'aa',
  platform: Platforms.GITHUB,
  name: 'bb',
  avatar_url: 'cc',
}

interface Issue extends IssueDashboardRead {
  organization?: OrganizationPublicRead
}

const issue: Issue = {
  platform: Platforms.GITHUB,
  organization_id: 'aa',
  repository_id: 'bb',
  number: 222,
  title: 'issue',
  reactions: {
    plus_one: 3,
  },
  state: State.OPEN,
  id: 'cc',
  issue_created_at: '2023-04-08',
  organization: org,
}

const repo: RepositoryRead = {
  platform: Platforms.GITHUB,
  external_id: 123,
  name: 'aa',
  id: 'bb',
  visibility: Visibility.PUBLIC,
  is_private: false,
}

export const Default: Story = {
  args: {
    pledges: pledges,
    references: references,
    repo: repo,
    org: org,
    issue: issue,
  },
}

export const TwoReferences: Story = {
  args: {
    pledges: pledges,
    references: doubleReference,
    repo: repo,
    org: org,
    issue: issue,
  },
}

export const ReferencesNoPledge: Story = {
  args: {
    pledges: [],
    references: doubleReference,
    repo: repo,
    org: org,
    issue: issue,
  },
}

export const PledgeNoReferences: Story = {
  args: {
    pledges: pledges,
    references: [],
    repo: repo,
    org: org,
    issue: issue,
  },
}
