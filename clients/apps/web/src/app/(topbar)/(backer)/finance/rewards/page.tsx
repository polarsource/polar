'use client'

import { HeaderPill, RewardsContent } from '@/components/Finance/Finance'
import AccountBanner from '@/components/Transactions/AccountBanner'
import { useAuth } from '@/hooks'
import { useListRewardsToUser } from '@/hooks/queries'

export default function Page() {
  const { currentUser } = useAuth()
  const rewards = useListRewardsToUser(currentUser?.id)

  const rewardsSum = rewards.data?.items
    ? rewards.data.items.map((r) => r.amount.amount).reduce((a, b) => a + b, 0)
    : 0

  return (
    <>
      {rewards.data?.items && currentUser && (
        <div className="flex flex-col space-y-8">
          <AccountBanner user={currentUser} />
          <HeaderPill
            title="Your rewards"
            amount={rewardsSum}
            active={true}
            href="/rewards"
          />
          <RewardsContent rewards={rewards.data.items} showReceiver={false} />
        </div>
      )}
    </>
  )
}
