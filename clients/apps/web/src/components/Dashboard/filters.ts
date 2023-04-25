import { NextRouter } from 'next/router'
import { IssueListType, IssueSortBy } from 'polarkit/api/client'

export type DashboardFilters = {
  q: string
  tab: IssueListType
  statusBacklog: boolean
  statusBuild: boolean
  statusPullRequest: boolean
  statusCompleted: boolean
  onlyPledged: boolean
  sort?: IssueSortBy
}

export const navigate = (router: NextRouter, filters: DashboardFilters) => {
  const params = new URLSearchParams()

  const statuses = []
  if (filters.statusBacklog) {
    statuses.push('backlog')
  }
  if (filters.statusBuild) {
    statuses.push('build')
  }
  if (filters.statusPullRequest) {
    statuses.push('pull_request')
  }
  if (filters.statusCompleted) {
    statuses.push('completed')
  }

  params.set('statuses', statuses.join(','))

  if (filters.q) {
    params.set('q', filters.q)
  }
  if (filters.tab) {
    params.set('tab', filters.tab)
  }
  if (filters.sort) {
    params.set('sort', filters.sort)
  }

  if (filters.onlyPledged) {
    params.set('onlyPledged', '1')
  }

  const url = new URL(window.location.href)
  const newPath = `${url.pathname}?${params.toString()}`
  router.push(url.pathname, newPath)
}
