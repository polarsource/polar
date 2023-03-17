import { useEffect, useState } from 'react'
import {
  OrganizationRead,
  type Entry_IssueRead_,
  type IssueRead,
  type PledgeRead,
  type PullRequestRead,
  type RepositoryRead,
} from '../api/client'
import { default as IssueListItem } from './IssueListItem'

type IssueListItemData = {
  org: OrganizationRead
  repo: RepositoryRead
  issue: IssueRead
  pullRequests: PullRequestRead[]
  pledges: PledgeRead[]
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
  orgs: Map<string, OrganizationRead>
  repos: Map<string, RepositoryRead>
  issues: Entry_IssueRead_[]
  pullRequests: Map<string, PullRequestRead>
  pledges: Map<string, PledgeRead>
}) => {
  const { issues, pullRequests, rewards, orgs, repos } = props

  const [sortedIssues, setSortedIssues] = useState<IssueListItemData[]>([])

  useEffect(() => {
    if (!issues) {
      return
    }
    const sorted = issues.map((issue): IssueListItemData => {
      return {
        issue: issue.attributes,
        pullRequests: populateRelations(issue, pullRequests, 'pull_request'),
        pledges: populateRelations(issue, pledges, 'pledge'),
        org: populateRelations(issue, orgs, 'organization')[0],
        repo: populateRelations(issue, repos, 'repository')[0],
      }
    })
    setSortedIssues(sorted)
  }, [issues, pullRequests, rewards, orgs, repos])

  if (!issues) return <div>Loading issues...</div>
  if (!pullRequests) return <div>Loading pull requests...</div>
  if (!rewards) return <div>Loading rewards...</div>

  return (
    <div className="space-y-2 divide-y divide-gray-200">
      {sortedIssues.map((i) => {
        return (
          <IssueListItem
            issue={i.issue}
            pullRequests={i.pullRequests}
            rewards={i.rewards}
            org={i.org}
            repo={i.repo}
            key={i.issue.id}
          />
        )
      })}
    </div>
  )
}

export default IssueList
