import { IssueListType, ListFundingSortBy } from '@polar-sh/sdk'

export type FundingFilters = {
  q: string
  tab: IssueListType
  badged?: boolean
  sort?: ListFundingSortBy[]
}

export const DefaultFilters: FundingFilters = {
  tab: IssueListType.ISSUES,
  q: '',
  sort: undefined,
  badged: false,
}
