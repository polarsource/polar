'use client'

import { ArrowsUpDownIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { FavoriteBorderOutlined, SearchOutlined } from '@mui/icons-material'
import { IssueListType, ListFundingSortBy, Organization } from '@polar-sh/sdk'
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
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Spinner from '../Shared/Spinner'
import { DefaultFilters, FundingFilters } from './filters'

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
  organization: Organization
}

const IssuesLookingForFunding = ({
  organization,
}: IssuesLookingForFundingProps) => {
  const search = useSearchParams()

  const initFilters = {
    ...DefaultFilters,
  }

  const didSetFiltersFromURL = useRef(false)

  const [filters, setFilters] = useState<FundingFilters>(initFilters)

  useEffect(() => {
    // Parse URL and use it to populate filters
    // TODO: can we do this on the initial load instead to avoid the effect / and ref
    if (!didSetFiltersFromURL.current) {
      didSetFiltersFromURL.current = true

      const s = search

      const f: FundingFilters = {
        ...DefaultFilters,
        q: s?.get('q') || '',
        tab: IssueListType.ISSUES,
      }
      if (s?.has('sort')) {
        f.sort = getSort(s.get('sort')?.split(',') ?? [])
      }
      if (s?.has('badged')) {
        f.badged = true
      }

      setFilters(f)
    }
  }, [search])

  const fundedIssues = useSearchFundedIssues({
    organizationName: organization.name,
    sort: filters.sort,
    badged: filters.badged,
  })

  return (
    <>
      <div className="flex flex-row items-center">
        <IssuesFilter filters={filters} onSetFilters={setFilters} />
      </div>
      <div className="-mx-6">
        {fundedIssues.data?.items?.map((i) => (
          <div key={i.issue.id}>
            <IssueSummary
              issue={i.issue}
              right={
                <Link
                  href={`/${i.issue.repository.organization.name}/${i.issue.repository.name}/issues/${i.issue.number}`}
                  className="font-medium text-blue-600"
                >
                  <Button size="sm" variant="secondary">
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
          </div>
        ))}
      </div>
    </>
  )
}

export default IssuesLookingForFunding

interface IssuesFilterProps {
  filters: FundingFilters
  onSetFilters: Dispatch<SetStateAction<FundingFilters>>
  totalCount?: number
  spinner?: boolean
}

export const IssuesFilter = (props: IssuesFilterProps) => {
  const router = useRouter()

  const navigate = (filters: FundingFilters) => {
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

    const url = new URL(window.location.href)
    const newPath = `${url.pathname}?${params.toString()}`
    router.replace(newPath, { scroll: false })
  }

  const getTitle = (sortBy: ListFundingSortBy[]): string => {
    const [initial] = sortBy
    let title = ''

    if (initial === ListFundingSortBy.NEWEST) {
      title = 'Newest'
    }
    if (initial === ListFundingSortBy.OLDEST) {
      title = 'Oldest'
    }
    if (initial === ListFundingSortBy.MOST_ENGAGEMENT) {
      title = 'Most engagement'
    }
    if (initial === ListFundingSortBy.MOST_FUNDED) {
      title = 'Most funded'
    }

    return sortBy.length > 1 ? `${title}, +${sortBy.length - 1}` : title
  }

  const options: ListFundingSortBy[] = useMemo(() => {
    return [
      ListFundingSortBy.MOST_ENGAGEMENT,
      ListFundingSortBy.MOST_FUNDED,
      ListFundingSortBy.NEWEST,
      ListFundingSortBy.OLDEST,
    ]
  }, [])

  const onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault()
    event.stopPropagation()

    // if not set, set to newest
    const sort = props.filters.sort || [ListFundingSortBy.NEWEST]
    const f: FundingFilters = {
      ...props.filters,
      q: event.target.value,
      sort,
    }
    props.onSetFilters(f)

    navigate(f)
  }

  const onOnlyBadgedChanged = (value: boolean) => {
    const f: FundingFilters = {
      ...props.filters,
      badged: value,
    }

    if (!value) {
      delete f.badged
    }

    props.onSetFilters(f)
    navigate(f)
  }

  const onSortingChanged = (value: ListFundingSortBy) => {
    return (checked: boolean) => {
      let sort = [...(props.filters.sort?.values() ?? [])]

      if (checked) {
        sort.push(value)
      } else {
        sort = sort.filter((v) => v !== value)
      }

      const f: FundingFilters = {
        ...props.filters,
        sort: [...sort],
      }

      if (!f.sort?.length) {
        delete f.sort
      }

      props.onSetFilters(f)
      navigate(f)
    }
  }

  const canFilterByBadged = props.filters.tab === IssueListType.ISSUES

  return (
    <div className="flex w-full flex-row items-center justify-between gap-x-4">
      <Input
        type="text"
        name="query"
        id="query"
        className="pl-11"
        placeholder="Search Filter"
        onChange={onQueryChange}
        value={props.filters.q || ''}
        preSlot={
          props.spinner ? (
            <span className="pl-2">
              <Spinner />
            </span>
          ) : (
            <SearchOutlined className="h-5 w-5" fontSize="inherit" />
          )
        }
      />

      {canFilterByBadged && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="secondary">
                <FunnelIcon className="dark:text-polar-300 mr-2 h-4 w-4" />
                <span>Filter</span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="dark:bg-polar-700">
              <DropdownMenuLabel>Filter</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuCheckboxItem
                checked={props.filters.badged}
                onCheckedChange={onOnlyBadgedChanged}
              >
                Badged Only
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="secondary">
            <ArrowsUpDownIcon className="dark:text-polar-300 mr-2 h-4 w-4" />
            <span>
              {props.filters?.sort?.length
                ? getTitle(props.filters?.sort)
                : 'Sort by'}
            </span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="dark:bg-polar-700">
          <DropdownMenuLabel>Sort issues by</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {options.map((v) => (
            <DropdownMenuCheckboxItem
              onCheckedChange={onSortingChanged(v)}
              key={v}
              checked={props.filters.sort?.includes(v)}
            >
              {getTitle([v])}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
