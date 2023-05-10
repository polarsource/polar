import DashboardLayout from 'components/Layout/DashboardLayout'
import OnboardingInstallChromeExtension from 'components/Onboarding/OnboardingInstallChromeExtension'
import { IssueStatus } from 'polarkit/api/client'
import { useDashboard } from 'polarkit/hooks'
import { Dispatch, SetStateAction } from 'react'
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

  return (
    <DashboardLayout
      filters={filters}
      onSetFilters={onSetFilters}
      showSidebar={true}
      isPersonalDashboard={false}
    >
      <div>
        <OnboardingInstallChromeExtension />
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

export default OrganizationDashboard
