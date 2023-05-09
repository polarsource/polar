import type { NextLayoutComponentType } from 'next'
import {
  IssueRead,
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
import {
  IssueListItemDecoration,
  getExpectedHeight,
} from 'polarkit/components/Issue'
import { ReactElement } from 'react'
import IssueListItem from '../../components/Dashboard/IssueListItem'

const Page: NextLayoutComponentType = () => {
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

  const issue: IssueRead = {
    platform: Platforms.GITHUB,
    external_id: 111,
    organization_id: 'aa',
    repository_id: 'bb',
    number: 222,
    title: 'issue',
    // body?: string;
    //comments?: number;
    // author?: any;
    // author_association?: string;
    // labels?: any;
    // assignee?: any;
    // assignees?: any;
    // milestone?: any;
    // closed_by?: any;
    reactions: {
      plus_one: 3,
    },
    state: State.OPEN,
    // state_reason?: string;
    // issue_closed_at?: string;
    // issue_modified_at?: string;
    // issue_created_at: string;
    id: 'cc',
    created_at: '2023-04-08',
    issue_created_at: '2023-04-08',
    //created_at: string;
    //modified_at?: string;
  }

  const org: OrganizationPublicRead = {
    id: 'aa',
    platform: Platforms.GITHUB,
    name: 'bb',
    avatar_url: 'cc',
  }

  const repo: RepositoryRead = {
    platform: Platforms.GITHUB,
    external_id: 123,
    name: 'aa',
    id: 'bb',
    visibility: Visibility.PUBLIC,
    is_private: false,
  }

  return (
    <div className="space-y-8 p-8">
      <p>
        This page renders <code>&lt;IssueListItemDecoration&gt;</code> in
        different permutations.
      </p>

      <h1 className="text-xl font-bold text-black">GitHub Style</h1>
      <FakeGitHubIssuesList
        pledges={pledges}
        references={references}
        doubleReferences={doubleReference}
      />

      <h1 className="text-xl font-bold text-black">Dashboard Style</h1>
      <div>
        <IssueListItem
          pledges={pledges}
          references={references}
          issue={issue}
          org={org}
          repo={repo}
        />
        <IssueListItem
          pledges={pledges}
          references={[]}
          issue={issue}
          org={org}
          repo={repo}
        />
        <IssueListItem
          pledges={[]}
          references={references}
          issue={issue}
          org={org}
          repo={repo}
        />
        <IssueListItem
          pledges={[]}
          references={doubleReference}
          issue={issue}
          org={org}
          repo={repo}
        />
      </div>
    </div>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <div>{page}</div>
}

export default Page

const FakeGitHubIssuesList = ({
  pledges,
  references,
  doubleReferences,
}: {
  pledges: PledgeRead[]
  references: IssueReferenceRead[]
  doubleReferences: IssueReferenceRead[]
}) => {
  return (
    <div className="w-[800px]">
      <div className="flex flex-col">
        <Pull />
        <Pull />
        <Extension pledges={pledges} references={references} />
        <Pull />
        <Extension pledges={pledges} references={[]} />
        <Pull />
        <Pull />
        <Extension pledges={[]} references={references} />
        <Pull />
        <Pull />
        <Extension pledges={[]} references={doubleReferences} />
        <Pull />
        <Extension pledges={pledges} references={doubleReferences} />
      </div>
    </div>
  )
}

const Extension = ({
  pledges,
  references,
}: {
  pledges: PledgeRead[]
  references: IssueReferenceRead[]
}) => {
  return (
    <div
      className="bg-[#F2F5FC]"
      style={{
        height: getExpectedHeight({ pledges, references }),
      }}
    >
      <IssueListItemDecoration
        orgName="test"
        repoName="test"
        pledges={pledges}
        references={references}
      />
    </div>
  )
}

const Pull = () => {
  return (
    <div className="flex h-12 items-center border-t-[1px] border-gray-300 border-black bg-gray-100">
      <h2>Title</h2>
    </div>
  )
}
