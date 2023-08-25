import { DashboardFilters, navigate } from '@/components/Dashboard/filters'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { InfiniteData } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import {
  IssueListResponse,
  IssueListType,
  IssueSortBy,
  UserRead,
} from 'polarkit/api/client'
import { IssueReadWithRelations } from 'polarkit/api/types'
import { Checkbox, PrimaryButton } from 'polarkit/components/ui'
import React, {
  ChangeEvent,
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react'
import yayson from 'yayson'
import Spinner from '../Shared/Spinner'
import IssueListItem from './IssueListItem'

const IssueList = (props: {
  dashboard?: InfiniteData<IssueListResponse>
  filters: DashboardFilters
  loading: boolean
  totalCount?: number
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
  fetchNextPage: () => void
  hasNextPage: boolean
  isInitialLoading: boolean
  isFetchingNextPage: boolean
  showSelfPledgesFor?: UserRead
}) => {
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = props

  const canAddRemovePolarLabel = props.filters.tab === IssueListType.ISSUES

  return (
    <div className="divide-y dark:divide-gray-800">
      {props.dashboard && (
        <>
          {!props.loading && (
            <>
              {props.dashboard.pages.map((group, i) => (
                <IssueListPage
                  page={group}
                  key={i}
                  canAddRemovePolarLabel={canAddRemovePolarLabel}
                  showSelfPledgesFor={props.showSelfPledgesFor}
                />
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

          {props &&
            props.totalCount !== undefined &&
            props.totalCount > 100 &&
            !hasNextPage && (
              <div className="p-4 text-center text-gray-500">
                You&apos;ve reached the bottom... 🏝️
              </div>
            )}
        </>
      )}
    </div>
  )
}

export default IssueList

const IssueListPage = (props: {
  page: IssueListResponse
  canAddRemovePolarLabel: boolean
  showSelfPledgesFor?: UserRead
}) => {
  const [issues, setIssues] = useState<IssueReadWithRelations[]>()

  const { page } = props

  useEffect(() => {
    if (page) {
      const y = yayson({ adapter: 'default' })
      const store = new y.Store()
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
          showIssueProgress={true}
          canAddRemovePolarLabel={props.canAddRemovePolarLabel}
          showPledgeAction={true}
          showSelfPledgesFor={props.showSelfPledgesFor}
        />
      ))}
    </>
  )
}

export const Header = (props: {
  filters: DashboardFilters
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
  totalCount?: number
  spinner?: boolean
}) => {
  const router = useRouter()

  const onSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value

    let sort: IssueSortBy =
      {
        newest: IssueSortBy.NEWEST,
        pledged_amount_desc: IssueSortBy.PLEDGED_AMOUNT_DESC,
        relevance: IssueSortBy.RELEVANCE,
        dependencies_default: IssueSortBy.DEPENDENCIES_DEFAULT,
        issues_default: IssueSortBy.ISSUES_DEFAULT,
        most_positive_reactions: IssueSortBy.MOST_POSITIVE_REACTIONS,
        most_engagement: IssueSortBy.MOST_ENGAGEMENT,
      }[value] || IssueSortBy.NEWEST

    const filters: DashboardFilters = {
      ...props.filters,
      sort,
    }

    props.onSetFilters(filters)
    navigate(router, filters)
  }

  const getTitle = (sortBy: IssueSortBy): string => {
    if (sortBy == IssueSortBy.NEWEST) {
      return 'Newest'
    }
    if (sortBy == IssueSortBy.PLEDGED_AMOUNT_DESC) {
      return 'Pledged amount'
    }
    if (sortBy == IssueSortBy.RELEVANCE) {
      return 'Relevance'
    }
    if (sortBy == IssueSortBy.DEPENDENCIES_DEFAULT) {
      return 'Most wanted'
    }
    if (sortBy == IssueSortBy.ISSUES_DEFAULT) {
      return 'Most wanted'
    }
    if (sortBy == IssueSortBy.MOST_POSITIVE_REACTIONS) {
      return 'Most reactions'
    }
    if (sortBy == IssueSortBy.MOST_ENGAGEMENT) {
      return 'Most engagement'
    }
    return 'Most wanted'
  }

  const tabFilters: IssueSortBy[] = useMemo(() => {
    const issuesTabFilters = [IssueSortBy.ISSUES_DEFAULT]
    const dependenciesTabFilters = [IssueSortBy.DEPENDENCIES_DEFAULT]

    return props.filters.tab === IssueListType.ISSUES
      ? issuesTabFilters
      : dependenciesTabFilters
  }, [props.filters.tab])

  const options: IssueSortBy[] = useMemo(() => {
    return [
      ...tabFilters,
      ...[
        IssueSortBy.MOST_POSITIVE_REACTIONS,
        IssueSortBy.MOST_ENGAGEMENT,
        IssueSortBy.NEWEST,
        IssueSortBy.PLEDGED_AMOUNT_DESC,
        IssueSortBy.RELEVANCE,
      ],
    ]
  }, [tabFilters])

  const width = useMemo(() => {
    const t = getTitle(props.filters.sort || tabFilters[0])
    return t.length * 7.5 + 35 // TODO(gustav): can we use the on-screen size instead somehow?
  }, [props.filters.sort, tabFilters])

  const onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault()
    event.stopPropagation()

    // if not set, set to relevance
    const sort = props.filters.sort || IssueSortBy.RELEVANCE
    const f: DashboardFilters = {
      ...props.filters,
      q: event.target.value,
      sort,
    }
    props.onSetFilters(f)

    navigate(router, f)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigate(router, props.filters)
  }

  const onOnlyBadgedChanged = (e: ChangeEvent<HTMLInputElement>) => {
    const f: DashboardFilters = {
      ...props.filters,
      onlyBadged: e.target.checked,
    }

    props.onSetFilters(f)
    navigate(router, f)
  }

  const canFilterByBadged = props.filters.tab === IssueListType.ISSUES

  return (
    <div className="justify-normal flex w-full flex-col items-center lg:flex-row lg:justify-between	">
      <div className="relative w-full py-2 lg:max-w-[500px]">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ">
          {props.spinner && <Spinner />}
          {!props.spinner && (
            <MagnifyingGlassIcon
              className="h-5 w-5 text-gray-500"
              aria-hidden="true"
            />
          )}
        </div>
        <input
          type="text"
          name="query"
          id="query"
          className="block w-full rounded-md border-0 bg-transparent py-2 pl-10 text-gray-900  placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 sm:text-sm sm:leading-6"
          placeholder="Search issues"
          onChange={onQueryChange}
          value={props.filters.q || ''}
        />
      </div>

      <div className="flex w-full flex-shrink-0 space-x-4 space-y-2 lg:w-fit lg:space-y-0">
        {canFilterByBadged && (
          <div className="inline-flex flex-shrink-0 items-center space-x-2 rounded-lg border bg-white py-2 pl-3 text-sm text-gray-500 shadow-sm  dark:bg-gray-900 dark:text-gray-400">
            <label htmlFor="only-badged">Only badged</label>
            <Checkbox
              id="only-badged"
              value={props.filters.onlyBadged}
              onChange={onOnlyBadgedChanged}
            >
              <></>
            </Checkbox>
          </div>
        )}

        <div className="flex-shrink-0 rounded-lg border bg-white py-2 px-3 shadow-sm dark:bg-gray-900">
          <label
            htmlFor="sort-by"
            className="mr-2 text-sm text-gray-500 dark:text-gray-400"
          >
            Sort by
          </label>
          <select
            id="sort-by"
            className="m-0 w-48 border-0 bg-transparent bg-right p-0 text-sm font-medium ring-0 focus:border-0 focus:ring-0 dark:bg-gray-900 dark:text-gray-300"
            onChange={onSelect}
            style={{ width: `${width}px` }}
            value={props.filters?.sort}
          >
            {options.map((v) => (
              <option key={v} value={v}>
                {getTitle(v)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
