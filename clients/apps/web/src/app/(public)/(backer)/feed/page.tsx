'use client'

import { Feed } from '@/components/Feed/Feed'
import { MySubscriptions } from '@/components/Feed/MySubscriptions'
import { useAuth } from '@/hooks'
import { useUserSubscriptions } from 'polarkit/hooks'

export default function Page() {
  const { currentUser } = useAuth()

  const userSubscriptions = useUserSubscriptions(
    currentUser?.id,
    undefined,
    9999,
  )

  const subscriptionsToRender =
    userSubscriptions.data?.items?.flatMap((item) => item.subscription_tier) ??
    []

  return (
    <div className="relative flex flex-row items-start gap-x-24">
      <div className="flex w-full max-w-xl flex-col gap-y-8 pb-12">
        <Feed />
      </div>
      <div className="w-full">
        {subscriptionsToRender.length > 0 && (
          <MySubscriptions subscriptionTiers={subscriptionsToRender} />
        )}
      </div>
    </div>
  )
}
