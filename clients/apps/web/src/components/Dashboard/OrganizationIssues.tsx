import OnboardingInstallChromeExtension from '@/components/Onboarding/OnboardingInstallChromeExtension'
import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'
import { IssueListType, IssueStatus, Label } from 'polarkit/api/client'
import { useDashboard, useListRepositories } from 'polarkit/hooks'
import { Dispatch, SetStateAction, useMemo } from 'react'
import DashboardLayout, { RepoPickerHeader } from '../Layout/DashboardLayout'
import OnboardingAddBadge from '../Onboarding/OnboardingAddBadge'
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
          issue.attributes.labels.some((l: Label) => l.name === 'polar'),
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

  // Get current org & repo from URL
  const { org: currentOrg, repo: currentRepo } = useCurrentOrgAndRepoFromURL()

  // Get all repositories
  const listRepositoriesQuery = useListRepositories()
  const allRepositories = listRepositoriesQuery?.data?.items
  if (!currentOrg || !allRepositories) {
    return <></>
  }

  // Filter repos by current org & normalize for our select
  const allOrgRepositories = allRepositories.filter(
    (r) => r?.organization?.id === currentOrg.id,
  )

  return (
    <DashboardLayout
      showSidebar={true}
      header={
        <RepoPickerHeader
          currentRepository={currentRepo}
          repositories={allOrgRepositories}
        >
          <Header
            totalCount={totalCount}
            filters={filters}
            onSetFilters={onSetFilters}
            spinner={dashboardQuery.isInitialLoading}
          />
        </RepoPickerHeader>
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
