'use client'

import IssueList from '@/components/Dashboard/IssueList'
import {
  DashboardFilters,
  DefaultFilters,
} from '@/components/Dashboard/filters'
import Recommended from '@/components/Feed/Recommended'
import FundAGithubIssue from '@/components/Onboarding/FundAGithubIssue'
import OnboardingConnectReposToGetStarted from '@/components/Onboarding/OnboardingConnectReposToGetStarted'
import { useAuth } from '@/hooks'
import { IssueListType, IssueStatus } from 'polarkit/api/client'
import { usePersonalDashboard } from 'polarkit/hooks'
import { useFeatureFlagEnabled } from 'posthog-js/react'

export default function Page() {
  const { currentUser } = useAuth()

  const filters: DashboardFilters = {
    ...DefaultFilters,
    tab: IssueListType.DEPENDENCIES,
    onlyPledged: true,
  }

  const dashboardQuery = usePersonalDashboard(
    filters.tab,
    filters.q,
    [
      IssueStatus.BACKLOG,
      IssueStatus.BUILDING,
      IssueStatus.CLOSED,
      IssueStatus.IN_PROGRESS,
      IssueStatus.PULL_REQUEST,
      IssueStatus.TRIAGED,
    ],
    filters.sort,
    filters.onlyPledged,
    filters.onlyBadged,
  )
  const dashboard = dashboardQuery.data
  const totalCount = dashboard?.pages[0].pagination.total_count ?? undefined

  const recommendationsEnabled = useFeatureFlagEnabled('feed-recommendations')

  // Onboarding splashscreen
  if (!dashboardQuery.isLoading && totalCount === 0) {
    return (
      <div className="mt-2 space-y-5">
        <FundAGithubIssue />
        {recommendationsEnabled && <Recommended />}
        {!recommendationsEnabled && <OnboardingConnectReposToGetStarted />}
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-5">
      <FundAGithubIssue />
      <IssueList
        totalCount={totalCount}
        loading={dashboardQuery.isLoading}
        dashboard={dashboard}
        filters={filters}
        onSetFilters={() => {}}
        isInitialLoading={dashboardQuery.isInitialLoading}
        isFetchingNextPage={dashboardQuery.isFetchingNextPage}
        hasNextPage={dashboardQuery.hasNextPage || false}
        fetchNextPage={dashboardQuery.fetchNextPage}
        showSelfPledgesFor={currentUser}
      />
      {recommendationsEnabled && <Recommended />}
    </div>
  )
}
