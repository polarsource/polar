'use client'

import { ArrowsUpDownIcon, FunnelIcon } from '@heroicons/react/24/outline'
import {
  FavoriteBorderOutlined,
  HowToVoteOutlined,
  SearchOutlined,
} from '@mui/icons-material'
import { ListFundingSortBy, Organization, Repository } from '@polar-sh/sdk'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  IssueActivityBox,
  IssueFundingDetails,
  IssueSummary,
} from 'polarkit/components/Issue'
import { Button, Input } from 'polarkit/components/ui/atoms'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useSearchFundedIssues } from 'polarkit/hooks'
import {
  ChangeEvent,
  Dispatch,
  Fragment,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from 'react'
import Spinner from '../Shared/Spinner'
import {
  DefaultFilters,
  FundingFilters,
  fundingSortingOptions,
  getFundSortingTitle,
} from './filters'

const getSort = (sort: string[] | null): ListFundingSortBy[] => {
  const sorting: ListFundingSortBy[] = []

  if (sort?.includes('oldest')) {
    sorting.push(ListFundingSortBy.OLDEST)
  }
  if (sort?.includes('newest')) {
    sorting.push(ListFundingSortBy.NEWEST)
  }
  if (sort?.includes('most_engagement')) {
    sorting.push(ListFundingSortBy.MOST_ENGAGEMENT)
  }
  if (sort?.includes('most_funded')) {
    sorting.push(ListFundingSortBy.MOST_FUNDED)
  }

  return sorting
}

interface IssuesLookingForFundingProps {
  repository?: Repository
  organization: Organization
}

const IssuesLookingForFunding = ({
  organization,
  repository,
}: IssuesLookingForFundingProps) => {
  const search = useSearchParams()

  const initialFilter = useMemo(() => {
    const s = search

    const f: FundingFilters = {
      ...DefaultFilters,
    }
    if (s?.has('q')) {
      f.q = s.get('q') || ''
    }
    if (s?.has('sort')) {
      f.sort = getSort(s.get('sort')?.split(',') ?? [])
    }
    if (s?.has('badged')) {
      f.badged = true
    }
    if (s?.has('showClosed')) {
      f.closed = undefined // undefined to show both closed and open issues
    }

    return f
  }, [])

  const [filters, setFilters] = useState<FundingFilters>(initialFilter)

  const fundedIssues = useSearchFundedIssues({
    organizationName: organization.name,
    repositoryName: repository?.name,
    sort: filters.sort,
    badged: filters.badged,
    q: filters.q,
    closed: filters.closed,
  })

  return (
    <div className="flex flex-col gap-y-8">
      <div className="flex flex-row items-center">
        <IssuesFilter filters={filters} onSetFilters={setFilters} />
      </div>
      {(fundedIssues.data?.items?.length ?? 0) > 0 ? (
        <motion.div
          className="dark:divider-polar-700 -mx-6 divide-y md:divide-y-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {fundedIssues.data?.items?.map((i) => (
            <Fragment key={i.issue.id}>
              <IssueSummary
                issue={i.issue}
                right={
                  <Link
                    href={`/${i.issue.repository.organization.name}/${i.issue.repository.name}/issues/${i.issue.number}`}
                    className="font-medium text-blue-600"
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
        </motion.div>
      ) : (
        <div className="dark:text-polar-600 flex flex-col items-center justify-center space-y-6 py-64 text-gray-400">
          <span className="text-6xl">
            <HowToVoteOutlined fontSize="inherit" />
          </span>
          <h2 className="text-lg">No funded issues found</h2>
        </div>
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
  totalCount,
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
      router.replace(newPath, { scroll: false })
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
            <Button variant="secondary" asChild>
              <FunnelIcon className="dark:text-polar-300 mr-2 h-4 w-4" />
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
            <Button variant="secondary" asChild>
              <ArrowsUpDownIcon className="dark:text-polar-300 mr-2 h-4 w-4" />
              <span>
                {filters?.sort?.length
                  ? getFundSortingTitle(filters?.sort)
                  : 'Sort by'}
              </span>
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
