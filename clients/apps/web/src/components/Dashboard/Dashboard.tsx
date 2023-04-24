import { useRouter } from 'next/router'
import {
  IssueListType,
  IssueSortBy,
  IssueStatus,
  OrganizationRead,
  RepositoryRead,
} from 'polarkit/api/client'
import { useSSE } from 'polarkit/hooks'
import { useEffect, useRef, useState } from 'react'
import OrganizationDashboard from './OrganizationDashboard'
import PersonalDashboard from './PersonalDashboard'
import { DashboardFilters } from './filters'

const buildStatusesFilter = (filters: DashboardFilters): Array<IssueStatus> => {
  const next = []
  filters.statusBacklog && next.push(IssueStatus.BACKLOG)
  filters.statusBuild && next.push(IssueStatus.BUILDING)
  filters.statusPullRequest && next.push(IssueStatus.PULL_REQUEST)
  filters.statusCompleted && next.push(IssueStatus.COMPLETED)
  return next
}

export const DefaultFilters: DashboardFilters = {
  tab: IssueListType.ISSUES,
  q: '',
  statusBacklog: true,
  statusBuild: true,
  statusPullRequest: true,
  statusCompleted: false,
  sort: undefined,
}

const getTab = (tab: string): IssueListType => {
  if (tab === 'dependencies') {
    return IssueListType.DEPENDENCIES
  }
  return IssueListType.ISSUES
}

const getSort = (sort: string): IssueSortBy => {
  if (sort === 'newest') {
    return IssueSortBy.NEWEST
  }
  if (sort === 'pledged_amount_desc') {
    return IssueSortBy.PLEDGED_AMOUNT_DESC
  }
  if (sort === 'relevance') {
    return IssueSortBy.RELEVANCE
  }
  if (sort === 'dependencies_default') {
    return IssueSortBy.DEPENDENCIES_DEFAULT
  }
  return IssueSortBy.NEWEST
}

const Dashboard = ({
  org,
  repo,
  isPersonal,
}: {
  org: OrganizationRead | undefined
  repo: RepositoryRead | undefined
  isPersonal: boolean
}) => {
  const router = useRouter()

  const initFilters = {
    ...DefaultFilters,
  }

  const didSetFiltersFromURL = useRef(false)

  const [filters, setFilters] = useState<DashboardFilters>(initFilters)

  // TODO: Unless we're sending user-only events we should probably delay SSE
  useSSE(org?.platform, org?.name, repo?.name)

  useEffect(() => {
    // Parse URL and use it to populate filters
    // TODO: can we do this on the initial load instead to avoid the effect / and ref
    if (!didSetFiltersFromURL.current) {
      didSetFiltersFromURL.current = true
      const s = new URLSearchParams(window.location.search)

      const useTab = isPersonal
        ? IssueListType.DEPENDENCIES
        : getTab(s.get('tab'))

      const f = {
        ...DefaultFilters,
        q: s.get('q'),
        tab: useTab,
      }
      if (s.has('statuses')) {
        const statuses = s.get('statuses').split(',')
        f.statusBacklog = statuses.includes('backlog')
        f.statusBuild = statuses.includes('build')
        f.statusPullRequest = statuses.includes('pull_request')
        f.statusCompleted = statuses.includes('completed')
      }
      if (s.has('sort')) {
        f.sort = getSort(s.get('sort'))
      }

      setFilters(f)
    }
  }, [router.query])

  let [statuses, setStatuses] = useState<Array<IssueStatus>>(
    buildStatusesFilter(filters),
  )

  useEffect(() => setStatuses(buildStatusesFilter(filters)), [filters])

  if (isPersonal) {
    return (
      <PersonalDashboard
        filters={filters}
        onSetFilters={setFilters}
        statuses={statuses}
      />
    )
  }

  if (!org || !org.name) {
    return <></>
  }

  return (
    <OrganizationDashboard
      filters={filters}
      onSetFilters={setFilters}
      statuses={statuses}
      orgName={org.name}
      repoName={repo?.name}
    />
  )
}

export default Dashboard
