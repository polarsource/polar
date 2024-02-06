import { IssueListType, IssueSortBy } from '@polar-sh/sdk'

export type DashboardFilters = {
  q: string
  tab: IssueListType
  statusBacklog: boolean
  statusTriaged: boolean
  statusInProgress: boolean
  statusPullRequest: boolean
  statusClosed: boolean
  onlyPledged: boolean
  onlyBadged: boolean
  sort?: IssueSortBy
}

export const DefaultFilters: DashboardFilters = {
  tab: IssueListType.ISSUES,
  q: '',
  statusBacklog: true,
  statusTriaged: true,
  statusInProgress: true,
  statusPullRequest: true,
  statusClosed: false,
  sort: undefined,
  onlyPledged: false,
  onlyBadged: false,
}
