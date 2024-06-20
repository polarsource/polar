'use client'

import IssueList from '@/components/Issues/IssueList'
import { DashboardFilters, DefaultFilters } from '@/components/Issues/filters'
import { useAuth } from '@/hooks'
import {
  useAccount,
  useListRewardsToUser,
  usePersonalDashboard,
} from '@/hooks/queries'
import { HowToVoteOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { Banner } from 'polarkit/components/ui/molecules'

export default function Page() {
  const { currentUser } = useAuth()

  const filters: DashboardFilters = {
    ...DefaultFilters,

    onlyPledged: true,
  }

  const dashboardQuery = usePersonalDashboard({
    q: filters.q,
    sort: filters.sort,
    onlyPledged: filters.onlyPledged,
    onlyBadged: filters.onlyBadged,
    showClosed: filters.showClosed,
  })

  const dashboard = dashboardQuery.data
  const totalCount = dashboard?.pages[0].pagination.total_count ?? undefined

  const rewards = useListRewardsToUser(currentUser?.id)
  const { data: account } = useAccount(currentUser?.account_id)

  const showPendingRewardsBanner =
    rewards.data?.items &&
    rewards.data?.items.length > 0 &&
    account === undefined

  return (
    <>
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

      {totalCount !== undefined && totalCount > 0 ? (
        <ShadowBoxOnMd className="flex flex-col gap-y-4">
          <h1 className="text-lg text-gray-950 dark:text-white">
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
        </ShadowBoxOnMd>
      ) : (
        <div className="dark:text-polar-400 flex h-full w-full flex-col items-center gap-y-4 pt-32 text-6xl text-gray-600">
          <HowToVoteOutlined fontSize="inherit" />
          <div className="flex flex-col items-center gap-y-2">
            <h3 className="p-2 text-xl font-medium">No funded issues</h3>
            <p className="dark:text-polar-500 min-w-0 truncate text-base text-gray-500">
              You haven&apos;t funded any issues yet
            </p>
          </div>
        </div>
      )}
    </>
  )
}
