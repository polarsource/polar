import { IssueSortBy } from '@polar-sh/sdk'

export type DashboardFilters = {
  q: string
  onlyPledged: boolean
  onlyBadged: boolean
  sort?: IssueSortBy
  showClosed: boolean
}

export const DefaultFilters: DashboardFilters = {
  q: '',
  sort: undefined,
  onlyPledged: false,
  onlyBadged: false,
  showClosed: false,
}
