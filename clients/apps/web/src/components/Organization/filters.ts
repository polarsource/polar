import { schemas } from '@polar-sh/client'
import { ReadonlyURLSearchParams } from 'next/navigation'

export type FundingFilters = {
  q?: string
  badged?: boolean
  sort?: schemas['ListFundingSortBy'][]
  closed?: boolean
}

export const DefaultFilters: FundingFilters = {
  q: undefined,
  sort: ['most_recently_funded'],
  badged: undefined,
  closed: false,
}

export const fundingSortingOptions = [
  'most_engagement',
  'most_funded',
  'most_recently_funded',
  'newest',
  'oldest',
]

export const getFundSortingTitle = (
  sortBy: schemas['ListFundingSortBy'][],
): string => {
  const [initial] = sortBy
  let title = ''

  if (initial === 'newest') {
    title = 'Newest'
  }
  if (initial === 'oldest') {
    title = 'Oldest'
  }
  if (initial === 'most_engagement') {
    title = 'Most engagement'
  }
  if (initial === 'most_funded') {
    title = 'Most funded'
  }
  if (initial === 'most_recently_funded') {
    title = 'Recently pledged'
  }

  return sortBy.length > 1 ? `${title}, +${sortBy.length - 1}` : title
}

export const getSort = (
  sort: string[] | null,
): schemas['ListFundingSortBy'][] => {
  const sorting: schemas['ListFundingSortBy'][] = []

  if (sort?.includes('oldest')) {
    sorting.push('oldest')
  }
  if (sort?.includes('newest')) {
    sorting.push('newest')
  }
  if (sort?.includes('most_engagement')) {
    sorting.push('most_engagement')
  }
  if (sort?.includes('most_funded')) {
    sorting.push('most_funded')
  }
  if (sort?.includes('most_recently_funded')) {
    sorting.push('most_recently_funded')
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
