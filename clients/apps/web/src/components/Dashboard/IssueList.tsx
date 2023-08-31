import { DashboardFilters } from '@/components/Dashboard/filters'
import {
  ArrowsUpDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { InfiniteData } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  IssueListResponse,
  IssueListType,
  IssueSortBy,
  UserRead,
} from 'polarkit/api/client'
import { IssueReadWithRelations } from 'polarkit/api/types'
import { PrimaryButton } from 'polarkit/components/ui'
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
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

  const navigate = (filters: DashboardFilters) => {
    const params = new URLSearchParams()

    const statuses = []
    if (filters.statusBacklog) {
      statuses.push('backlog')
    }
    if (filters.statusTriaged) {
      statuses.push('triaged')
    }
    if (filters.statusInProgress) {
      statuses.push('in_progress')
    }
    if (filters.statusPullRequest) {
      statuses.push('pull_request')
    }
    if (filters.statusClosed) {
      statuses.push('closed')
    }

    params.set('statuses', statuses.join(','))

    if (filters.q) {
      params.set('q', filters.q)
    }

    if (filters.sort) {
      params.set('sort', filters.sort)
    }

    if (filters.onlyPledged) {
      params.set('onlyPledged', '1')
    }

    if (filters.onlyBadged) {
      params.set('onlyBadged', '1')
    }

    const url = new URL(window.location.href)
    const newPath = `${url.pathname}?${params.toString()}`
    router.push(newPath)
  }

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
    navigate(filters)
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

    navigate(f)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigate(props.filters)
  }

  const onOnlyBadgedChanged = (value: boolean) => {
    const f: DashboardFilters = {
      ...props.filters,
      onlyBadged: value,
    }

    props.onSetFilters(f)
    navigate(f)
  }

  const onShowClosedChanged = (value: boolean) => {
    const f: DashboardFilters = {
      ...props.filters,
      statusClosed: value,
    }

    props.onSetFilters(f)
    navigate(f)
  }

  const onSortingChanged = (value: string) => {
    const f: DashboardFilters = {
      ...props.filters,
      sort: value as IssueSortBy,
    }

    props.onSetFilters(f)
    navigate(f)
  }

  const canFilterByBadged = props.filters.tab === IssueListType.ISSUES

  return (
    <div className="flex w-full flex-col items-center justify-normal pr-4 lg:flex-row lg:justify-between">
      <div className="relative w-fit w-full py-2 lg:max-w-[500px]">
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

      <div className="flex w-full flex-shrink-0 items-center justify-center space-x-12 lg:w-fit lg:justify-start lg:space-x-6 lg:space-y-0 lg:space-y-0 ">
        {canFilterByBadged && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex flex-shrink-0 items-center space-x-2 text-sm text-gray-900 dark:text-gray-100">
                <FunnelIcon className="h-4 w-4 text-black dark:text-white" />
                <span className="font-medium">Filter</span>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuLabel>Filter</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuCheckboxItem
                  checked={props.filters.onlyBadged}
                  onCheckedChange={onOnlyBadgedChanged}
                >
                  Only badged
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={props.filters.statusClosed}
                  onCheckedChange={onShowClosedChanged}
                >
                  Show closed
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex flex-shrink-0 items-center space-x-2 text-sm text-gray-900 dark:text-gray-100">
            <ArrowsUpDownIcon className="h-4 w-4 text-black dark:text-white" />
            <span className="font-medium">
              {props.filters?.sort
                ? getTitle(props.filters?.sort)
                : 'Most wanted'}
            </span>
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            <DropdownMenuLabel>Sort issues by</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuRadioGroup
              value={props.filters?.sort}
              onValueChange={onSortingChanged}
            >
              {options.map((v) => (
                <DropdownMenuRadioItem key={v} value={v}>
                  {getTitle(v)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
