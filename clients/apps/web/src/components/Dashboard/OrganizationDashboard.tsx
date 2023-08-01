import OnboardingInstallChromeExtension from '@/components/Onboarding/OnboardingInstallChromeExtension'
import { IssueListType, IssueStatus } from 'polarkit/api/client'
import { useDashboard } from 'polarkit/hooks'
import { Dispatch, SetStateAction, useMemo } from 'react'
import DashboardIssuesFilterLayout from '../Layout/DashboardIssuesFilterLayout'
import DashboardLayout from '../Layout/DashboardLayout'
import OnboardingAddBadge from '../Onboarding/OnboardingAddBadge'
import OnboardingAddDependency from '../Onboarding/OnboardingAddDependency'
import { LabelSchema } from './IssueLabel'
import IssueList from './IssueList'
import { DashboardFilters } from './filters'

const OrganizationDashboard = ({
  orgName,
  repoName,
  filters,
  statuses,
  onSetFilters,
}: {
  orgName: string
  repoName: string | undefined
  filters: DashboardFilters
  statuses: Array<IssueStatus>
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
}) => {
  const dashboardQuery = useDashboard(
    orgName,
    repoName,
    filters.tab,
    filters.q,
    statuses,
    filters.sort,
    filters.onlyPledged,
  )
  const dashboard = dashboardQuery.data
  const totalCount = dashboard?.pages[0].pagination.total_count || undefined

  const haveIssues = useMemo(() => {
    return totalCount !== undefined && totalCount > 0
  }, [totalCount])

  const showDependenciesOnboarding = useMemo(() => {
    return (
      filters.tab === IssueListType.DEPENDENCIES &&
      dashboardQuery.isLoading === false &&
      haveIssues === false
    )
  }, [filters, totalCount, dashboardQuery])

  const showChromeOnboarding = useMemo(() => {
    return !showDependenciesOnboarding
  }, [showDependenciesOnboarding])

  const showList = useMemo(() => {
    return !showDependenciesOnboarding
  }, [showDependenciesOnboarding])

  const anyIssueHasPledgeOrBadge = useMemo(() => {
    return dashboardQuery.data?.pages.some((p) =>
      p.data.some(
        (issue) =>
          issue.attributes.labels &&
          issue.attributes.labels.some((l: LabelSchema) => l.name === 'polar'),
      ),
    )
  }, [dashboardQuery])

  const isDefaultFilters = useMemo(() => {
    return (
      filters.statusBacklog &&
      filters.statusTriaged &&
      filters.statusInProgress &&
      filters.statusPullRequest &&
      !filters.statusClosed
    )
  }, [filters])

  const showAddBadgeBanner = useMemo(() => {
    return (
      showList &&
      filters.tab === IssueListType.ISSUES &&
      dashboardQuery.isLoading === false &&
      haveIssues &&
      anyIssueHasPledgeOrBadge === false &&
      isDefaultFilters
    )
  }, [
    showList,
    filters,
    dashboardQuery,
    anyIssueHasPledgeOrBadge,
    haveIssues,
    isDefaultFilters,
  ])

  return (
    <DashboardLayout isPersonalDashboard={true}>
      <DashboardIssuesFilterLayout
        filters={filters}
        onSetFilters={onSetFilters}
        isPersonalDashboard={false}
      >
        {JSON.stringify(filters)}
        <div>
          {showChromeOnboarding && <OnboardingInstallChromeExtension />}
          {showDependenciesOnboarding && <OnboardingAddDependency />}
          {showAddBadgeBanner && <OnboardingAddBadge />}
          {showList && (
            <IssueList
              totalCount={totalCount}
              loading={dashboardQuery.isLoading}
              dashboard={dashboard}
              filters={filters}
              onSetFilters={onSetFilters}
              isInitialLoading={dashboardQuery.isInitialLoading}
              isFetchingNextPage={dashboardQuery.isFetchingNextPage}
              hasNextPage={dashboardQuery.hasNextPage || false}
              fetchNextPage={dashboardQuery.fetchNextPage}
            />
          )}
        </div>
      </DashboardIssuesFilterLayout>
    </DashboardLayout>
  )
}

export default OrganizationDashboard
