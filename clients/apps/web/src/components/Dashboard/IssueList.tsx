import { DashboardFilters } from 'components/Dashboard/filters'
import Spinner from 'components/Shared/Spinner'
import { IssueSortBy } from 'polarkit/api/client'
import { IssueReadWithRelations } from 'polarkit/api/types'
import { IssueListItem } from 'polarkit/components'
import { Dispatch, SetStateAction, useMemo } from 'react'

const IssueList = (props: {
  issues: IssueReadWithRelations[]
  filters: DashboardFilters
  loading: boolean
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
}) => {
  const { issues } = props

  if (!issues) return <></>

  return (
    <div className="divide-y">
      <Header
        count={issues.length}
        filters={props.filters}
        onSetFilters={props.onSetFilters}
      />

      {props.loading && (
        <div className="flex justify-around py-8">
          <Spinner />
        </div>
      )}

      {!props.loading &&
        issues.map((issue) => {
          return (
            <IssueListItem
              issue={issue}
              references={issue.references}
              dependents={issue.dependents}
              pledges={issue.pledges}
              org={issue.organization}
              repo={issue.repository}
              key={issue.id}
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

    props.onSetFilters({
      ...props.filters,
      sort,
    })
  }

  const title = useMemo(() => {
    return {
      newest: 'Newest',
      pledged_amount_desc: 'Pledged amount',
      relevance: 'Relevance',
    }
  }, [])

  const options = ['newest', 'pledged_amount_desc', 'relevance']

  const width = useMemo(() => {
    const t = title[props.filters.sort] || 'Newest'
    return t.length * 7.5 + 35 // TODO(gustav): can we use the on-screen size instead somehow?
  }, [props.filters.sort, title])

  return (
    <div className="flex h-12 items-center justify-between px-2">
      <div className="text-sm">
        <strong className="font-medium">{props.count}</strong>{' '}
        <span className="text-gray-500">issues</span>
      </div>

      <div>
        <span className="mr-2 text-sm text-gray-500">Sort:</span>
        <select
          className="m-0 w-48 border-0 bg-right p-0 text-sm font-medium ring-0 focus:border-0 focus:ring-0"
          onChange={onSelect}
          style={{ width: `${width}px` }}
          value={props.filters?.sort}
        >
          {options.map((v) => (
            <option key={v} value={v}>
              {title[v]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
