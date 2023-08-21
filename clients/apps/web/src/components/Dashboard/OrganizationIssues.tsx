import OnboardingInstallChromeExtension from '@/components/Onboarding/OnboardingInstallChromeExtension'
import { IssueListType, IssueStatus } from 'polarkit/api/client'
import { useDashboard } from 'polarkit/hooks'
import { Dispatch, SetStateAction, useMemo } from 'react'
import DashboardLayout from '../Layout/DashboardLayout'
import OnboardingAddBadge from '../Onboarding/OnboardingAddBadge'
import { LabelSchema } from './IssueLabel'
import IssueList, { Header } from './IssueList'
import { DashboardFilters } from './filters'

const OrganizationIssues = ({
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
    filters.onlyBadged,
  )
  const dashboard = dashboardQuery.data
  const totalCount = dashboard?.pages[0].pagination.total_count || undefined

  const haveIssues = useMemo(() => {
    return totalCount !== undefined && totalCount > 0
  }, [totalCount])

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
      filters.tab === IssueListType.ISSUES &&
      dashboardQuery.isLoading === false &&
      haveIssues &&
      anyIssueHasPledgeOrBadge === false &&
      isDefaultFilters
    )
  }, [
    filters,
    dashboardQuery,
    anyIssueHasPledgeOrBadge,
    haveIssues,
    isDefaultFilters,
  ])

  return (
    <DashboardLayout
      showSidebar={true}
      header={
        <Header
          totalCount={totalCount}
          filters={filters}
          onSetFilters={onSetFilters}
          spinner={dashboardQuery.isInitialLoading}
        />
      }
    >
      <div className="space-y-4">
        <OnboardingInstallChromeExtension />
        {showAddBadgeBanner && <OnboardingAddBadge />}

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

export default OrganizationIssues
