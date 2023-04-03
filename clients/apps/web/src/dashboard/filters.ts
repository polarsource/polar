import { IssueListType, IssueSortBy } from 'polarkit/api/client'

export type DashboardFilters = {
  q: string
  tab: IssueListType
  statusBacklog: boolean
  statusBuild: boolean
  statusPullRequest: boolean
  statusCompleted: boolean
  sort?: IssueSortBy
}
