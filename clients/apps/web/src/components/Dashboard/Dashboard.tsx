import DashboardLayout from 'components/Layout/DashboardLayout'
import OnboardingConnectReposToGetStarted from 'components/Onboarding/OnboardingConnectReposToGetStarted'
import { useRouter } from 'next/router'
import {
  IssueListType,
  IssueStatus,
  OrganizationRead,
  RepositoryRead,
} from 'polarkit/api/client'
import { IssueReadWithRelations } from 'polarkit/api/types'
import { useDashboard, useSSE } from 'polarkit/hooks'
import { useEffect, useRef, useState } from 'react'
import yayson from 'yayson'
import { DashboardFilters } from './filters'
import IssueList from './IssueList'

const y = yayson({ adapter: 'default' })
const store = new y.Store()

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
  if (tab === 'following') {
    return IssueListType.FOLLOWING
  }
  if (tab === 'pledged') {
    return IssueListType.PLEDGED
  }
  return IssueListType.ISSUES
}

const Dashboard = ({
  org,
  repo,
  haveOrgs,
}: {
  org: OrganizationRead | undefined
  repo: RepositoryRead | undefined
  haveOrgs: boolean
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

      const f = {
        ...DefaultFilters,
        q: s.get('q'),
        tab: getTab(s.get('tab')),
      }
      if (s.has('statuses')) {
        const statuses = s.get('statuses').split(',')
        f.statusBacklog = statuses.includes('backlog')
        f.statusBuild = statuses.includes('build')
        f.statusPullRequest = statuses.includes('pull_request')
        f.statusCompleted = statuses.includes('completed')
      }

      setFilters(f)
    }
  }, [router.query])

  let [statuses, setStatuses] = useState<Array<IssueStatus>>(
    buildStatusesFilter(filters),
  )

  useEffect(() => setStatuses(buildStatusesFilter(filters)), [filters])

  const dashboardQuery = useDashboard(
    org?.name,
    repo?.name,
    filters.tab,
    filters.q,
    statuses,
    filters.sort,
  )
  const dashboard = dashboardQuery.data

  const [issues, setIssues] = useState<IssueReadWithRelations[]>()

  useEffect(() => {
    if (dashboard) {
      const issues: IssueReadWithRelations[] = store.sync(dashboard)
      setIssues(issues)
    } else {
      setIssues([])
    }
  }, [dashboard])

  const [showOnboardConnectTakeover, setShowOnboardConnectTakeover] =
    useState(false)
  const [showOnboardConnectPopup, setShowOnboardConnectPopup] = useState(false)

  useEffect(() => {
    setShowOnboardConnectTakeover(
      !haveOrgs && dashboard?.data && dashboard.data.length === 0,
    )
    setShowOnboardConnectPopup(
      !haveOrgs && dashboard?.data && dashboard.data.length > 0,
    )
  }, [haveOrgs, dashboard])

  if (showOnboardConnectTakeover) {
    return (
      <DashboardLayout
        filters={filters}
        onSetFilters={setFilters}
        showSidebar={false}
      >
        <OnboardingConnectReposToGetStarted />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      filters={filters}
      onSetFilters={setFilters}
      showSidebar={true}
    >
      <div>
        {showOnboardConnectPopup && <OnboardingConnectReposToGetStarted />}
        <IssueList
          loading={dashboardQuery.isLoading}
          issues={issues}
          filters={filters}
          onSetFilters={setFilters}
        />
      </div>
    </DashboardLayout>
  )
}

export default Dashboard
