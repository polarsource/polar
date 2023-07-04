import OnboardingInstallChromeExtension from '@/components/Onboarding/OnboardingInstallChromeExtension'
import { IssueListType, IssueStatus } from 'polarkit/api/client'
import { useDashboard } from 'polarkit/hooks'
import { Dispatch, SetStateAction, useMemo } from 'react'
import DashboardSidebarLayout from '../Layout/DashboardSidebarLayout'
import OnboardingAddDependency from '../Onboarding/OnboardingAddDependency'
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

  const showDependenciesOnboarding = useMemo(() => {
    return (
      filters.tab === IssueListType.DEPENDENCIES &&
      dashboardQuery.isLoading === false &&
      (totalCount === 0 || totalCount === undefined)
    )
  }, [filters, totalCount, dashboardQuery])

  const showChromeOnboarding = useMemo(() => {
    return !showDependenciesOnboarding
  }, [showDependenciesOnboarding])

  const showList = useMemo(() => {
    return !showDependenciesOnboarding
  }, [showDependenciesOnboarding])

  return (
    <DashboardSidebarLayout
      filters={filters}
      onSetFilters={onSetFilters}
      showSidebar={true}
      isPersonalDashboard={false}
    >
      <div>
        {showChromeOnboarding && <OnboardingInstallChromeExtension />}
        {showDependenciesOnboarding && <OnboardingAddDependency />}
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
    </DashboardSidebarLayout>
  )
}

export default OrganizationDashboard
