import { DashboardFilters } from 'dashboard/filters'
import {
  IssueReferenceRead,
  IssueSortBy,
  OrganizationRead,
  type Entry_IssueRead_,
  type IssueRead,
  type PledgeRead,
  type RepositoryRead,
} from 'polarkit/api/client'
import { IssueListItem } from 'polarkit/components'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'

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
  filters: DashboardFilters
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
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
      <Header
        count={sortedIssues.length}
        filters={props.filters}
        onSetFilters={props.onSetFilters}
      />

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

const Header = (props: {
  filters: DashboardFilters
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
  count: number
}) => {
  const onSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value

    let sort: IssueSortBy = {
      newest: IssueSortBy.NEWEST,
      pledged_amount_desc: IssueSortBy.PLEDGED_AMOUNT_DESC,
      relevance: IssueSortBy.RELEVANCE,
    }[value]

    console.log('new sort', sort)

    props.onSetFilters({
      ...props.filters,
      sort,
    })
  }

  return (
    <div className="flex h-12 items-center justify-between">
      <div className="text-sm">
        <strong className="font-medium">{props.count}</strong>{' '}
        <span className="text-black/50">issues</span>
      </div>

      <div>
        <span>Sort:</span>
        <select
          className="selected:border-0 border-0 ring-0"
          onChange={onSelect}
          defaultValue={props.filters?.sort}
        >
          <option value="newest">Newest</option>
          <option value="pledged_amount_desc">Pledged amount</option>
          <option value="relevance">Relevance</option>
        </select>
      </div>
    </div>
  )
}
