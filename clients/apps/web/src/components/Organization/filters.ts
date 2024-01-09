import { ListFundingSortBy } from '@polar-sh/sdk'
import { ReadonlyURLSearchParams } from 'next/navigation'

export type FundingFilters = {
  q?: string
  badged?: boolean
  sort?: ListFundingSortBy[]
  closed?: boolean
}

export const DefaultFilters: FundingFilters = {
  q: undefined,
  sort: [ListFundingSortBy.MOST_RECENTLY_FUNDED],
  badged: undefined,
  closed: false,
}

export const fundingSortingOptions = [
  ListFundingSortBy.MOST_ENGAGEMENT,
  ListFundingSortBy.MOST_FUNDED,
  ListFundingSortBy.MOST_RECENTLY_FUNDED,
  ListFundingSortBy.NEWEST,
  ListFundingSortBy.OLDEST,
]

export const getFundSortingTitle = (sortBy: ListFundingSortBy[]): string => {
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
  if (initial === ListFundingSortBy.MOST_RECENTLY_FUNDED) {
    title = 'Recently pledged'
  }

  return sortBy.length > 1 ? `${title}, +${sortBy.length - 1}` : title
}

export const getSort = (sort: string[] | null): ListFundingSortBy[] => {
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
  if (sort?.includes('most_recently_funded')) {
    sorting.push(ListFundingSortBy.MOST_RECENTLY_FUNDED)
  }

  return sorting
}

export const buildFundingFilters = (
  s: ReadonlyURLSearchParams,
): FundingFilters => {
  const f: FundingFilters = {
    ...DefaultFilters,
  }

  if (s.has('q')) {
    f.q = s.get('q') || ''
  }
  if (s.has('sort')) {
    f.sort = getSort(s.get('sort')?.split(',') ?? [])
  }
  if (s.has('badged')) {
    f.badged = true
  }
  if (s.has('showClosed')) {
    f.closed = undefined // undefined to show both closed and open issues
  }

  return f
}

export type FilterSearchParams = {
  sort: string | undefined
  q: string | undefined
  badged: string | undefined
  showClosed: string | undefined
  page: string | undefined
}

export const urlSearchFromObj = (
  searchParams: FilterSearchParams,
): ReadonlyURLSearchParams => {
  const urlSearch = new URLSearchParams()
  if (searchParams.sort) {
    for (const s of searchParams.sort.split(',')) {
      urlSearch.append('sort', s)
    }
  }
  if (searchParams.q) {
    urlSearch.append('q', searchParams.q)
  }
  if (searchParams.badged) {
    urlSearch.append('badged', searchParams.badged)
  }
  if (searchParams.showClosed) {
    urlSearch.append('showClosed', searchParams.showClosed)
  }
  return new ReadonlyURLSearchParams(urlSearch)
}
