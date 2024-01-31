'use client'

import IssueList from '@/components/Dashboard/IssueList'
import {
  DashboardFilters,
  DefaultFilters,
} from '@/components/Dashboard/filters'
import Recommended from '@/components/Feed/Recommended'
import FundAGithubIssue from '@/components/Onboarding/FundAGithubIssue'
import { useAuth, useGitHubAccount } from '@/hooks'
import { IssueListType, IssueStatus } from '@polar-sh/sdk'
import Link from 'next/link'
import { Banner } from 'polarkit/components/ui/molecules'
import {
  useAccount,
  useListRewardsToUser,
  usePersonalDashboard,
} from 'polarkit/hooks'

const FundingPage = () => {
  const { currentUser } = useAuth()
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
  const { data: account } = useAccount(currentUser?.account_id)

  const showPendingRewardsBanner =
    rewards.data?.items &&
    rewards.data?.items.length > 0 &&
    account === undefined

  return (
    <div className="flex flex-col-reverse gap-8 px-4 md:flex-row md:gap-16 md:px-0">
      <div className="mb-24 mt-2 w-full space-y-10">
        <div className="space-y-10">
          {showPendingRewardsBanner && (
            <Banner color="blue">
              <div className="flex w-full items-center justify-between">
                <span>
                  Great news! You have pending rewards and payouts. Setup a
                  Stripe account to get paid.
                </span>
                <Link href="/rewards" className="whitespace-nowrap font-medium">
                  Go to Rewards
                </Link>
              </div>
            </Banner>
          )}

          {totalCount !== undefined && totalCount > 0 && (
            <div className="flex flex-col gap-y-4">
              <h1 className="dark:text-polar-50 text-lg text-gray-950">
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
      <div className="top-26 sticky flex w-full flex-col md:max-w-sm">
        <FundAGithubIssue />
      </div>
    </div>
  )
}

export default FundingPage
