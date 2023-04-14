import DashboardLayout from 'components/Layout/DashboardLayout'
import OnboardingConnectReposToGetStarted from 'components/Onboarding/OnboardingConnectReposToGetStarted'
import { IssueStatus } from 'polarkit/api/client'
import { IssueReadWithRelations } from 'polarkit/api/types'
import { useDashboard } from 'polarkit/hooks'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import yayson from 'yayson'
import { DashboardFilters } from './filters'
import IssueList from './IssueList'

const y = yayson({ adapter: 'default' })
const store = new y.Store()

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

  const [showOnboardConnectPopup, setShowOnboardConnectPopup] = useState(false)

  return (
    <DashboardLayout
      filters={filters}
      onSetFilters={onSetFilters}
      showSidebar={true}
      isPersonalDashboard={false}
    >
      <div>
        {showOnboardConnectPopup && <OnboardingConnectReposToGetStarted />}
        <IssueList
          loading={dashboardQuery.isLoading}
          issues={issues}
          filters={filters}
          onSetFilters={onSetFilters}
        />
      </div>
    </DashboardLayout>
  )
}

export default OrganizationDashboard
