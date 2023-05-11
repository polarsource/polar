import { InfiniteData } from '@tanstack/react-query'
import { DashboardFilters, navigate } from 'components/Dashboard/filters'
import Spinner from 'components/Shared/Spinner'
import { useRouter } from 'next/router'
import {
  IssueListResponse,
  IssueListType,
  IssueSortBy,
} from 'polarkit/api/client'
import { IssueReadWithRelations } from 'polarkit/api/types'
import { PrimaryButton } from 'polarkit/components/ui'
import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react'
import yayson from 'yayson'
import IssueListItem from './IssueListItem'

const IssueList = (props: {
  dashboard: InfiniteData<IssueListResponse>
  filters: DashboardFilters
  loading: boolean
  totalCount?: number
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetching: boolean
  isFetchingNextPage: boolean
}) => {
  if (!props.dashboard) {
    return <></>
  }

  const { fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = props

  return (
    <div className="divide-y">
      <Header
        totalCount={props.totalCount}
        filters={props.filters}
        onSetFilters={props.onSetFilters}
        spinner={isFetching && !isFetchingNextPage}
      />

      {!props.loading && (
        <>
          {props.dashboard.pages.map((group, i) => (
            <IssueListPage page={group} key={i} />
          ))}
        </>
      )}

      {hasNextPage && (
        <PrimaryButton
          loading={isFetchingNextPage}
          disabled={isFetchingNextPage}
          onClick={fetchNextPage}
        >
          Load more
        </PrimaryButton>
      )}

      {props.totalCount > 100 && !hasNextPage && (
        <div className="p-4 text-center text-gray-500">
          You&apos;ve reached the bottom... 🏝️
        </div>
      )}
    </div>
  )
}

export default IssueList

const IssueListPage = (props: { page: IssueListResponse }) => {
  const [issues, setIssues] = useState<IssueReadWithRelations[]>()

  const y = yayson({ adapter: 'default' })
  const store = new y.Store()

  const { page } = props

  useEffect(() => {
    if (page) {
      const issues: IssueReadWithRelations[] = store.sync(page)
      setIssues(issues)
    } else {
      setIssues([])
    }
  }, [page])

  if (!issues) {
    return <></>
  }

  return (
    <>
      {issues.map((issue) => (
        <IssueListItem
          issue={issue}
          references={issue.references}
          dependents={issue.dependents}
          pledges={issue.pledges}
          org={issue.organization}
          repo={issue.repository}
          key={issue.id}
        />
      ))}
    </>
  )
}

const Header = (props: {
  filters: DashboardFilters
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
  totalCount?: number
  spinner?: boolean
}) => {
  const router = useRouter()

  const onSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value

    let sort: IssueSortBy = {
      newest: IssueSortBy.NEWEST,
      pledged_amount_desc: IssueSortBy.PLEDGED_AMOUNT_DESC,
      relevance: IssueSortBy.RELEVANCE,
      dependencies_default: IssueSortBy.DEPENDENCIES_DEFAULT,
      issues_default: IssueSortBy.ISSUES_DEFAULT,
    }[value]

    const filters = {
      ...props.filters,
      sort,
    }

    props.onSetFilters(filters)
    navigate(router, filters)
  }

  const title = useMemo(() => {
    return {
      newest: 'Newest',
      pledged_amount_desc: 'Pledged amount',
      relevance: 'Relevance',
      dependencies_default: 'Most wanted',
      issues_default: 'Most wanted',
    }
  }, [])

  const issuesTabFilters = ['issues_default']
  const dependenciesTabFilters = ['dependencies_default']

  const tabFilters =
    props.filters.tab === IssueListType.ISSUES
      ? issuesTabFilters
      : dependenciesTabFilters

  const options = [].concat(tabFilters, [
    'newest',
    'pledged_amount_desc',
    'relevance',
  ])

  const width = useMemo(() => {
    const t = title[props.filters.sort] || 'Most wanted'
    return t.length * 7.5 + 35 // TODO(gustav): can we use the on-screen size instead somehow?
  }, [props.filters.sort, title])

  return (
    <div className="flex h-12 items-center justify-between px-2">
      <div className="text-sm">
        {props.totalCount !== undefined && (
          <>
            <strong className="font-medium">{props.totalCount}</strong>{' '}
            <span className="text-gray-500">issues</span>
          </>
        )}
      </div>

      {props.spinner && <Spinner />}

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
