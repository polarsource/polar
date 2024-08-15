'use client'

import IssueBadge from '@/components/Embed/IssueBadge'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { Product } from '@polar-sh/sdk'
import { twMerge } from 'tailwind-merge'
import { MOCKED_SUBSCRIPTIONS } from '../utils'

const SubCard = ({
  className,
  subscriptionTier,
}: {
  className?: string
  subscriptionTier: Partial<Product>
}) => {
  return (
    <SubscriptionTierCard
      className={twMerge(className, 'dark:ring-polar-700 dark:ring-1')}
      subscriptionTier={{ ...subscriptionTier, description: ' ' }}
      variant="small"
    />
  )
}

export const HeroGraphic = () => {
  return (
    <div className="flex w-full flex-col items-center gap-y-12">
      <div className="relative flex h-full w-full flex-row items-center justify-center gap-6">
        <SubCard
          className="shadow-3xl absolute left-0 scale-75"
          subscriptionTier={MOCKED_SUBSCRIPTIONS[0]}
        />
        <SubCard
          className="shadow-3xl absolute -right-6 z-20"
          subscriptionTier={MOCKED_SUBSCRIPTIONS[2]}
        />
      </div>
      <div className="flex h-fit w-full flex-col items-center gap-y-4">
        <div className="flex-center flex flex-col">
          <span className="hidden dark:inline-block">
            <IssueBadge
              maxWidth="720px"
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
              maxWidth="720px"
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
