import { useEffect, useState } from 'react'
import {
  IssueReferenceRead,
  OrganizationRead,
  Relationship,
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
  relationships: Relationship[] | undefined,
  lookup: Map<string, T>,
  typ: string,
): T[] => {
  const r =
    relationships
      ?.filter((rel) => rel.data.type === typ)
      .map((rel) => lookup.get(rel.data.id))
      .filter(Boolean)
      .map((r) => r as T) || []
  return r
}

const populateRelation = <T,>(
  relationship: Relationship | undefined,
  lookup: Map<string, T>,
  typ: string,
): T | undefined =>
  relationship && populateRelations([relationship], lookup, typ)[0]

const IssueList = (props: {
  orgs: Map<string, OrganizationRead>
  repos: Map<string, RepositoryRead>
  issues: Entry_IssueRead_[]
  references: Map<string, IssueReferenceRead>
  dependencies: Map<string, IssueRead>
  pledges: Map<string, PledgeRead>
}) => {
  const { issues, references, dependencies, pledges, orgs, repos } = props

  const [sortedIssues, setSortedIssues] = useState<IssueListItemData[]>([])

  useEffect(() => {
    if (!issues) {
      return
    }
    const sorted = issues.map((issue): IssueListItemData => {
      return {
        issue: issue.attributes,
        references: populateRelations(
          issue.relationships?.references,
          references,
          'reference',
        ),
        dependencies: populateRelations(
          issue.relationships?.dependencies,
          dependencies,
          'issue',
        ),
        pledges: populateRelations(
          issue.relationships?.references,
          pledges,
          'pledge',
        ),
        org: populateRelation(
          issue.relationships?.organization,
          orgs,
          'organization',
        ),
        repo: populateRelation(
          issue.relationships?.repository,
          repos,
          'repository',
        ),
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
