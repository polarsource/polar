import DashboardLayout from 'components/Layout/DashboardLayout'
import OnboardingConnectPersonalDashboard from 'components/Onboarding/OnboardingConnectDashboard'
import { IssueStatus } from 'polarkit/api/client'
import { usePersonalDashboard } from 'polarkit/hooks'
import { Dispatch, SetStateAction } from 'react'
import IssueList from './IssueList'
import { DashboardFilters } from './filters'

const PersonalDashboard = ({
  filters,
  statuses,
  onSetFilters,
}: {
  filters: DashboardFilters
  statuses: Array<IssueStatus>
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
}) => {
  const dashboardQuery = usePersonalDashboard(
    filters.tab,
    filters.q,
    statuses,
    filters.sort,
    filters.onlyPledged,
  )
  const dashboard = dashboardQuery.data
  const totalCount = dashboard?.pages[0].pagination.total_count || undefined

  return (
    <DashboardLayout
      filters={filters}
      onSetFilters={onSetFilters}
      showSidebar={true}
      isPersonalDashboard={true}
    >
      <div>
        <OnboardingConnectPersonalDashboard />
        <IssueList
          totalCount={totalCount}
          loading={dashboardQuery.isLoading}
          dashboard={dashboard}
          filters={filters}
          onSetFilters={onSetFilters}
          isFetching={dashboardQuery.isFetching}
          isFetchingNextPage={dashboardQuery.isFetchingNextPage}
          hasNextPage={dashboardQuery.hasNextPage}
          fetchNextPage={dashboardQuery.fetchNextPage}
        />
      </div>
    </DashboardLayout>
  )
}

export default PersonalDashboard
