import OnboardingConnectPersonalDashboard from '@/components/Onboarding/OnboardingConnectDashboard'
import { IssueStatus } from 'polarkit/api/client'
import { usePersonalDashboard } from 'polarkit/hooks'
import { Dispatch, SetStateAction } from 'react'
import DashboardLayout from '../Layout/DashboardLayout'
import IssueList, { Header } from './IssueList'
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
    filters.onlyBadged,
  )
  const dashboard = dashboardQuery.data
  const totalCount = dashboard?.pages[0].pagination.total_count || undefined

  return (
    <DashboardLayout
      header={
        <Header
          totalCount={totalCount}
          filters={filters}
          onSetFilters={onSetFilters}
          spinner={dashboardQuery.isInitialLoading}
        />
      }
    >
      <div>
        <OnboardingConnectPersonalDashboard />
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
      </div>
    </DashboardLayout>
  )
}

export default PersonalDashboard
