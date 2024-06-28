'use client'

import IssueBadge from '@/components/Embed/IssueBadge'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { MOCKED_SUBSCRIPTIONS } from '../utils'

export const HeroGraphic = () => {
  return (
    <div className="flex w-full flex-col items-center gap-y-12">
      <div className="relative flex h-full w-full flex-row items-center justify-center gap-6">
        <SubscriptionTierCard
          className="dark:bg-polar-950 absolute left-0 scale-90"
          subscriptionTier={{ ...MOCKED_SUBSCRIPTIONS[1], description: ' ' }}
          variant="small"
        />
        <SubscriptionTierCard
          className="dark:bg-polar-950 shadow-3xl z-20"
          subscriptionTier={{ ...MOCKED_SUBSCRIPTIONS[0], description: ' ' }}
          variant="small"
        />
        <SubscriptionTierCard
          className="dark:bg-polar-950 absolute right-0 scale-90"
          subscriptionTier={{ ...MOCKED_SUBSCRIPTIONS[2], description: ' ' }}
          variant="small"
        />
      </div>
      <div className="flex h-fit w-full flex-col items-center gap-y-4">
        <div className="flex-center flex flex-col">
          <span className="hidden dark:inline-block">
            <IssueBadge
              darkmode={true}
              funding={{
                funding_goal: {
                  amount: 90000,
                  currency: 'USD',
                },
                pledges_sum: {
                  amount: 45000,
                  currency: 'USD',
                },
              }}
              avatarsUrls={[
                'https://avatars.githubusercontent.com/u/1144727?v=4',
                'https://avatars.githubusercontent.com/u/281715?v=4',
                'https://avatars.githubusercontent.com/u/10053249?v=4',
              ]}
              upfront_split_to_contributors={75}
              orgName="polarsource"
              issueIsClosed={false}
              donationsEnabled={true}
            />
          </span>
          <span className="dark:hidden">
            <IssueBadge
              darkmode={false}
              funding={{
                funding_goal: {
                  amount: 90000,
                  currency: 'USD',
                },
                pledges_sum: {
                  amount: 45000,
                  currency: 'USD',
                },
              }}
              avatarsUrls={[
                'https://avatars.githubusercontent.com/u/1144727?v=4',
                'https://avatars.githubusercontent.com/u/281715?v=4',
                'https://avatars.githubusercontent.com/u/10053249?v=4',
              ]}
              upfront_split_to_contributors={75}
              orgName="polarsource"
              issueIsClosed={false}
              donationsEnabled={true}
            />
          </span>
        </div>
      </div>
    </div>
  )
}
