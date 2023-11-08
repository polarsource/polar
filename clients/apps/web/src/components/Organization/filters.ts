import { ListFundingSortBy } from '@polar-sh/sdk'

export type FundingFilters = {
  q?: string
  badged?: boolean
  sort?: ListFundingSortBy[]
}

export const DefaultFilters: FundingFilters = {
  q: undefined,
  sort: undefined,
  badged: true,
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
