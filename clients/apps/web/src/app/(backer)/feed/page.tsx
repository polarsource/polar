'use client'

import IssueList from '@/components/Dashboard/IssueList'
import {
  DashboardFilters,
  DefaultFilters,
} from '@/components/Dashboard/filters'
import Recommended from '@/components/Feed/Recommended'
import FundAGithubIssue from '@/components/Onboarding/FundAGithubIssue'
import { useGitHubAccount, useRequireAuth } from '@/hooks'
import { IssueListType, IssueStatus } from '@polar-sh/sdk'
import Link from 'next/link'
import { Banner } from 'polarkit/components/ui/molecules'
import {
  useListAccountsByUser,
  useListRewardsToUser,
  usePersonalDashboard,
} from 'polarkit/hooks'

export default function Page() {
  const { currentUser } = useRequireAuth()
  const githubAccount = useGitHubAccount()

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

  const rewards = useListRewardsToUser(currentUser?.id)
  const accounts = useListAccountsByUser(currentUser?.id)

  const showPendingRewardsBanner =
    rewards.data?.items &&
    rewards.data?.items.length > 0 &&
    accounts.data?.items &&
    accounts.data.items.length === 0

  return (
    <div className="mb-24 mt-2 space-y-10">
      <div className="space-y-10">
        {showPendingRewardsBanner && (
          <Banner color="blue">
            <div className="flex w-full items-center justify-between">
              <span>
                Great news! You have pending rewards and payouts. Setup a Stripe
                account to get paid.
              </span>
              <Link href="/rewards" className="whitespace-nowrap font-medium">
                Go to Rewards
              </Link>
            </div>
          </Banner>
        )}

        <FundAGithubIssue />

        {totalCount !== undefined && totalCount > 0 && (
          <div>
            <h1 className="dark:text-polar-300 text-lg text-gray-900">
              Funded issues
            </h1>
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
            />
          </div>
        )}
      </div>

      {githubAccount && <Recommended />}
    </div>
  )
}
