import { DashboardFilters } from '@/components/Issues/filters'
import {
  ArrowsUpDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { IssueListResponse, IssueSortBy } from '@polar-sh/sdk'
import { InfiniteData } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { ChangeEvent, Dispatch, SetStateAction, useMemo } from 'react'
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
}) => {
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = props

  const canAddRemovePolarLabel = true

  return (
    <div>
      {props.dashboard && (
        <>
          {!props.loading && (
            <>
              {props.dashboard.pages.map((group, i) => (
                <IssueListPage
                  page={group}
                  key={i}
                  canAddRemovePolarLabel={canAddRemovePolarLabel}
                />
              ))}
            </>
          )}

          {hasNextPage && (
            <Button
              loading={isFetchingNextPage}
              disabled={isFetchingNextPage}
              onClick={fetchNextPage}
            >
              Load more
            </Button>
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
}) => {
  return (
    <>
      {props.page.data.map((issue) => (
        <IssueListItem
          issue={issue.attributes}
          references={issue.references || []}
          pledges={issue.pledges || []}
          pledgesSummary={issue.pledges_summary}
          rewards={issue.rewards}
          key={issue.attributes.id}
          canAddRemovePolarLabel={props.canAddRemovePolarLabel}
          showPledgeAction={true}
          showIssueOpenClosedStatus={true}
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
    if (sortBy == IssueSortBy.MOST_RECENTLY_FUNDED) {
      return 'Recently pledged'
    }
    return 'Most wanted'
  }

  const tabFilters = [IssueSortBy.ISSUES_DEFAULT]

  const options: IssueSortBy[] = useMemo(() => {
    return [
      ...tabFilters,
      ...[
        IssueSortBy.MOST_POSITIVE_REACTIONS,
        IssueSortBy.MOST_ENGAGEMENT,
        IssueSortBy.NEWEST,
        IssueSortBy.PLEDGED_AMOUNT_DESC,
        IssueSortBy.MOST_RECENTLY_FUNDED,
        IssueSortBy.RELEVANCE,
      ],
    ]
  }, [tabFilters])

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

  const canFilterByBadged = true

  return (
    <div className="flex w-full flex-row flex-wrap items-center justify-between gap-2 md:flex-nowrap md:gap-4">
      <div className="relative w-full min-w-[140px] py-2 md:min-w-[200px]">
        <Input
          type="text"
          name="query"
          id="query"
          className="pl-11"
          placeholder="Search issues"
          onChange={onQueryChange}
          value={props.filters.q || ''}
          preSlot={
            props.spinner ? (
              <span className="pl-2">
                <Spinner />
              </span>
            ) : (
              <MagnifyingGlassIcon
                className="dark:text-polar-500 h-6 w-6 pl-1 text-lg text-gray-500"
                aria-hidden="true"
              />
            )
          }
        />
      </div>

      <div className="flex w-fit flex-shrink-0 items-center justify-center gap-x-4 lg:justify-start">
        {canFilterByBadged && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger className="dark:hover:bg-polar-700 dark:border-polar-700 dark:bg-polar-800 inline-flex flex-shrink-0 items-center space-x-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">
                <FunnelIcon className="dark:text-polar-300 h-4 w-4" />
                <span>Filter</span>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="dark:bg-polar-700">
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
          <DropdownMenuTrigger className="dark:hover:bg-polar-700 dark:border-polar-700 dark:bg-polar-800 inline-flex flex-shrink-0 items-center space-x-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">
            <ArrowsUpDownIcon className="dark:text-polar-300 h-4 w-4" />
            <span>
              {props.filters?.sort
                ? getTitle(props.filters?.sort)
                : 'Most wanted'}
            </span>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="dark:bg-polar-700">
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
