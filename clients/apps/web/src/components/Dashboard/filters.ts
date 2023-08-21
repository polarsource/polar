import { NextRouter } from 'next/router'
import { IssueListType, IssueSortBy } from 'polarkit/api/client'

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

export const navigate = (router: NextRouter, filters: DashboardFilters) => {
  const params = new URLSearchParams()

  const statuses = []
  if (filters.statusBacklog) {
    statuses.push('backlog')
  }
  if (filters.statusTriaged) {
    statuses.push('triaged')
  }
  if (filters.statusInProgress) {
    statuses.push('in_progress')
  }
  if (filters.statusPullRequest) {
    statuses.push('pull_request')
  }
  if (filters.statusClosed) {
    statuses.push('closed')
  }

  params.set('statuses', statuses.join(','))

  if (filters.q) {
    params.set('q', filters.q)
  }

  if (filters.sort) {
    params.set('sort', filters.sort)
  }

  if (filters.onlyPledged) {
    params.set('onlyPledged', '1')
  }

  if (filters.onlyBadged) {
    params.set('onlyBadged', '1')
  }

  const url = new URL(window.location.href)
  const newPath = `${url.pathname}?${params.toString()}`
  router.push(url.pathname, newPath)
}
