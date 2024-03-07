'use client'

import {
  FavoriteBorderOutlined,
  FilterList,
  HowToVoteOutlined,
  SearchOutlined,
  SwapVertOutlined,
} from '@mui/icons-material'
import {
  ListFundingSortBy,
  ListResourceIssueFunding,
  Organization,
  Repository,
} from '@polar-sh/sdk'
import Link from 'next/link'
import {
  ReadonlyURLSearchParams,
  useRouter,
  useSearchParams,
} from 'next/navigation'
import {
  IssueActivityBox,
  IssueFundingDetails,
  IssueSummary,
} from 'polarkit/components/Issue'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useSearchFunding } from 'polarkit/hooks'
import { organizationPageLink } from 'polarkit/utils/nav'
import {
  ChangeEvent,
  Dispatch,
  Fragment,
  SetStateAction,
  useCallback,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'
import Pagination, { usePagination } from '../Pagination/Pagination'
import Spinner from '../Shared/Spinner'
import {
  FundingFilters,
  buildFundingFilters,
  fundingSortingOptions,
  getFundSortingTitle,
} from './filters'

interface IssuesLookingForFundingProps {
  repository?: Repository
  organization: Organization
  pageSize?: number
  issues: ListResourceIssueFunding
}

const IssuesLookingForFunding = ({
  organization,
  repository,
  pageSize = 20,
  issues,
}: IssuesLookingForFundingProps) => {
  const search = useSearchParams() as ReadonlyURLSearchParams
  const initialFilter = buildFundingFilters(search)

  const [filters, setFilters] = useState<FundingFilters>(initialFilter)
  const { currentPage, setCurrentPage } = usePagination()

  const clientIssues = useSearchFunding({
    organizationName: organization.name,
    repositoryName: repository?.name,
    sort: filters.sort,
    badged: filters.badged,
    q: filters.q,
    closed: filters.closed,
    page: currentPage,
    limit: pageSize,
  })

  const listIssues =
    (clientIssues.isFetched ? clientIssues.data?.items : issues.items) ?? []

  return (
    <div className="flex flex-col gap-y-8">
      <div className="flex flex-row items-center">
        <IssuesFilter filters={filters} onSetFilters={setFilters} />
      </div>
      {listIssues.length > 0 ? (
        <Pagination
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          totalCount={
            clientIssues.data?.pagination.total_count ??
            issues.pagination.total_count
          }
          currentURL={search}
        >
          <div className="dark:divider-polar-700 -mx-6 flex flex-col divide-y md:divide-y-0">
            {listIssues.map((i) => (
              <Fragment key={i.issue.id}>
                <IssueSummary
                  issue={i.issue}
                  right={
                    <Link
                      href={organizationPageLink(
                        i.issue.repository.organization,
                        `${i.issue.repository.name}/issues/${i.issue.number}`,
                      )}
                      className="font-medium text-blue-500"
                    >
                      <Button size="sm" variant="secondary" asChild>
                        <FavoriteBorderOutlined fontSize="inherit" />
                        <span className="ml-1.5">Fund</span>
                      </Button>
                    </Link>
                  }
                />
                {(i.total.amount > 0 ||
                  !!i.funding_goal ||
                  !!i.issue.upfront_split_to_contributors) && (
                  <IssueActivityBox>
                    <div className="p-4">
                      <IssueFundingDetails
                        issue={i.issue}
                        total={i.total}
                        fundingGoal={i.funding_goal}
                        pledgesSummaries={i.pledges_summaries}
                      />
                    </div>
                  </IssueActivityBox>
                )}
              </Fragment>
            ))}
          </div>
        </Pagination>
      ) : (
        <>
          {clientIssues.isFetched && listIssues.length === 0 ? (
            <div className="dark:text-polar-600 flex flex-col items-center justify-center space-y-6 py-64 text-gray-400">
              <span className="text-6xl">
                <HowToVoteOutlined fontSize="inherit" />
              </span>
              <h2 className="text-lg">No issues found</h2>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default IssuesLookingForFunding

interface IssuesFilterProps {
  filters: FundingFilters
  onSetFilters: Dispatch<SetStateAction<FundingFilters>>
  totalCount?: number
  spinner?: boolean
}

export const IssuesFilter = ({
  filters,
  onSetFilters,
  spinner,
}: IssuesFilterProps) => {
  const router = useRouter()

  const navigate = useCallback(
    (filters: FundingFilters) => {
      const params = new URLSearchParams()

      if (filters.q) {
        params.set('q', filters.q)
      }

      if (filters.sort) {
        params.set('sort', filters.sort.join(','))
      }

      if (filters.badged) {
        params.set('badged', '1')
      }

      if (filters.closed === undefined) {
        params.set('showClosed', '1')
      }

      const url = new URL(window.location.href)
      const newPath = `${url.pathname}?${params.toString()}`
      // "Shallow navigation" (don't execute any nextjs navigation)
      window.history.pushState({}, '', newPath)
    },
    [router],
  )

  const onQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      event.preventDefault()
      event.stopPropagation()

      // if not set, set to newest
      const sort = filters.sort || [ListFundingSortBy.NEWEST]
      const f: FundingFilters = {
        ...filters,
        q: event.target.value,
        sort,
      }

      if (!f.q?.length) {
        delete f.q
      }

      onSetFilters(f)

      navigate(f)
    },
    [navigate, onSetFilters, filters],
  )

  const onOnlyBadgedChanged = useCallback(
    (value: boolean) => {
      const f: FundingFilters = {
        ...filters,
        badged: value,
      }

      if (!value) {
        delete f.badged
      }

      onSetFilters(f)
      navigate(f)
    },
    [navigate, onSetFilters, filters],
  )

  const onShowClosed = useCallback(
    (value: boolean) => {
      const f: FundingFilters = {
        ...filters,
        closed: value ? undefined : false,
      }
      onSetFilters(f)
      navigate(f)
    },
    [navigate, onSetFilters, filters],
  )

  const onSortingChanged = useCallback(
    (value: ListFundingSortBy) => {
      return (checked: boolean) => {
        let sort = [...(filters.sort?.values() ?? [])]

        if (checked) {
          sort.push(value)
        } else {
          sort = sort.filter((v) => v !== value)
        }

        const f: FundingFilters = {
          ...filters,
          sort: [...sort],
        }

        if (!f.sort?.length) {
          delete f.sort
        }

        onSetFilters(f)
        navigate(f)
      }
    },
    [navigate, filters, onSetFilters],
  )

  return (
    <div className="flex w-full flex-col items-center gap-4 md:flex-row">
      <div className="w-full grow md:w-auto">
        <Input
          type="text"
          name="query"
          id="query"
          placeholder="Search Filter"
          onChange={onQueryChange}
          value={filters.q || ''}
          preSlot={
            spinner ? (
              <span className="pl-2">
                <Spinner />
              </span>
            ) : (
              <SearchOutlined className="h-5 w-5" fontSize="inherit" />
            )
          }
        />
      </div>

      <div className="flex w-full flex-row items-center gap-x-4 md:w-auto">
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <Button className="text-xs" variant="secondary" asChild>
              <FilterList
                fontSize="small"
                className={twMerge(
                  'dark:text-polar-300 mr-2 h-4 w-4 text-blue-300',
                  (filters?.badged === true || filters?.closed === undefined) &&
                    'text-blue-500 dark:text-blue-400',
                )}
              />
              <span>Filter</span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="dark:bg-polar-700">
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuCheckboxItem
              checked={filters.badged}
              onCheckedChange={onOnlyBadgedChanged}
            >
              Badged Only
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={filters.closed === undefined}
              onCheckedChange={onShowClosed}
            >
              Show Closed
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <Button className="text-xs" variant="secondary" asChild>
              <SwapVertOutlined
                fontSize="small"
                className={twMerge(
                  'dark:text-polar-300 mr-2 h-4 w-4 text-blue-300',
                  (filters?.sort?.length ?? 0) > 0 &&
                    'text-blue-500 dark:text-blue-400',
                )}
              />
              <span>Sort by</span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="dark:bg-polar-700">
            <DropdownMenuLabel>Sort issues by</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {fundingSortingOptions.map((v) => (
              <DropdownMenuCheckboxItem
                onCheckedChange={onSortingChanged(v)}
                key={v}
                checked={filters.sort?.includes(v)}
              >
                {getFundSortingTitle([v])}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
