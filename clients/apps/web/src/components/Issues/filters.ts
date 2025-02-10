import { schemas } from '@polar-sh/client'

export type DashboardFilters = {
  q: string
  onlyPledged: boolean
  onlyBadged: boolean
  sort?: schemas['IssueSortBy']
  showClosed: boolean
}

export const DefaultFilters: DashboardFilters = {
  q: '',
  sort: undefined,
  onlyPledged: false,
  onlyBadged: false,
  showClosed: false,
}
