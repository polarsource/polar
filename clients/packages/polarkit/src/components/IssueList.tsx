import { useEffect, useState } from 'react'
import {
  OrganizationRead,
  type Entry_IssueRead_,
  type IssueRead,
  type PullRequestRead,
  type RepositoryRead,
  type RewardRead,
} from '../api/client'
import { default as IssueListItem } from './IssueListItem'

const lastTimestamp = (issue: IssueRead) => {
  const timestamps = [
    new Date(issue.issue_created_at),
    // TODO: Latest comment, commit, etc.
  ]

  if (issue.issue_closed_at) {
    timestamps.push(new Date(issue.issue_closed_at))
  }
  if (issue.issue_modified_at) {
    timestamps.push(new Date(issue.issue_modified_at))
  }

  const sorted = timestamps
    .filter((d) => Boolean(d))
    .sort((a, b) => {
      return b.getTime() - a.getTime()
    })

  return sorted[0]
}

const pullRequestsForIssue = (
  issue: IssueRead,
  pullRequests: PullRequestRead[],
): PullRequestRead[] => {
  const re = new RegExp(
    `(Close|Closes|Closed|Fix|Fixes|Fixed|Resolve|Resolves|Resolved) #${issue.number}(?![0-9])`,
    'gi',
  )

  const filtered = pullRequests.filter((pr) => {
    if (pr.body && re.test(pr.body)) return true
    return false
  })

  return filtered
}

type IssueListItemData = {
  issue: IssueRead
  pullRequests: PullRequestRead[]
  rewards: RewardRead[]
  org: OrganizationRead
  repo: RepositoryRead
}

const populateRelations = <T,>(
  issue: Entry_IssueRead_,
  lookup: Map<string, T>,
  typ: string,
): T[] => {
  const r =
    issue.relationships
      ?.filter((rel) => rel.data.type === typ)
      .map((rel) => lookup.get(rel.data.id))
      .filter(Boolean)
      .map((r) => r as T) || []

  console.log(typ, issue.relationships, r)
  return r
}

const IssueList = (props: {
  issues: Entry_IssueRead_[]
  pullRequests: PullRequestRead[]
  rewards: Map<string, RewardRead>
  orgs: Map<string, OrganizationRead>
  repos: Map<string, RepositoryRead>
}) => {
  const { issues, pullRequests, rewards, orgs, repos } = props
  if (!issues) return <div>Loading issues...</div>
  if (!pullRequests) return <div>Loading pull requests...</div>
  if (!rewards) return <div>Loading rewards...</div>

  const [sortedIssues, setSortedIssues] = useState<IssueListItemData[]>([])

  useEffect(() => {
    const sorted = issues.map((issue): IssueListItemData => {
      return {
        issue: issue.attributes,
        pullRequests: pullRequestsForIssue(issue.attributes, pullRequests),
        rewards: populateRelations(issue, rewards, 'reward'),
        org: populateRelations(issue, orgs, 'organization')[0],
        repo: populateRelations(issue, repos, 'repository')[0],
      }
    })
    setSortedIssues(sorted)
  }, [issues, pullRequests, rewards, orgs, repos])

  return (
    <div className="space-y-2 divide-y divide-gray-200">
      {sortedIssues.map((i) => {
        return (
          <>
            <IssueListItem
              issue={i.issue}
              pullRequests={i.pullRequests}
              rewards={i.rewards}
              org={i.org}
              repo={i.repo}
              key={i.issue.id}
            />
          </>
        )
      })}
    </div>
  )
}

export default IssueList
