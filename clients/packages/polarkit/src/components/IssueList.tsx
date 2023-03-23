import { useEffect, useState } from 'react'
import {
  IssueReferenceRead,
  OrganizationRead,
  type Entry_IssueRead_,
  type IssueRead,
  type PledgeRead,
  type RepositoryRead,
} from '../api/client'
import { default as IssueListItem } from './IssueListItem'

type IssueListItemData = {
  org: OrganizationRead
  repo: RepositoryRead
  issue: IssueRead
  references: IssueReferenceRead[]
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
  return r
}

const IssueList = (props: {
  orgs: Map<string, OrganizationRead>
  repos: Map<string, RepositoryRead>
  issues: Entry_IssueRead_[]
  references: Map<string, IssueReferenceRead>
  pledges: Map<string, PledgeRead>
}) => {
  const { issues, references, pledges, orgs, repos } = props

  const [sortedIssues, setSortedIssues] = useState<IssueListItemData[]>([])

  useEffect(() => {
    if (!issues) {
      return
    }
    const sorted = issues.map((issue): IssueListItemData => {
      return {
        issue: issue.attributes,
        references: populateRelations(issue, references, 'reference'),
        pledges: populateRelations(issue, pledges, 'pledge'),
        org: populateRelations(issue, orgs, 'organization')[0],
        repo: populateRelations(issue, repos, 'repository')[0],
      }
    })
    setSortedIssues(sorted)
  }, [issues, references, pledges, orgs, repos])

  if (!issues) return <div>Loading issues...</div>
  if (!references) return <div>Loading references...</div>
  if (!pledges) return <div>Loading pledges...</div>

  return (
    <div className="space-y-2 divide-y divide-gray-200">
      {sortedIssues.map((i) => {
        return (
          <IssueListItem
            issue={i.issue}
            references={i.references}
            pledges={i.pledges}
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
