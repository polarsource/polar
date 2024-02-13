import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { ArrowForwardOutlined, Bolt } from '@mui/icons-material'
import { Button } from 'polarkit/components/ui/atoms'

export const SetupSubscriptions = () => {
  return (
    <div className="flex grid-cols-2 flex-col gap-6 md:grid xl:grid-cols-3">
      <div className="col-span-2 flex flex-col gap-y-4 md:gap-y-6 md:py-6 lg:col-span-1">
        <Bolt
          className="hidden text-blue-500 dark:text-blue-400 md:block"
          fontSize="large"
        />
        <h2 className="text-2xl font-bold">Subscription Tiers</h2>
        <p className="dark:text-polar-400 text-gray-600 [text-wrap:balance]">
          Create a few subscription tiers to offer your followers and supporters
        </p>
        <Button className="self-start">
          <span>Activate Tiers</span>
          <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
        </Button>
      </div>
      <div className="col-span-2 flex flex-row items-center gap-x-8">
        <SubscriptionTierCard
          className="w-full"
          subscriptionTier={{
            type: 'free',
            name: 'Follower',
            description: 'Get notified when new posts are published',
            benefits: [
              {
                id: '123',
                type: 'articles',
                selectable: false,
                deletable: false,
                description: 'Public Posts',
                created_at: '2021-10-01T00:00:00Z',
              },
            ],
          }}
        />
        <SubscriptionTierCard
          className="w-full"
          subscriptionTier={{
            type: 'individual',
            name: 'Supporter',
            price_amount: 500,
            description: 'Exclusive insight into my coding endeavours',
            benefits: [
              {
                id: '123',
                type: 'articles',
                selectable: false,
                deletable: false,
                description: 'Premium Posts',
                created_at: '2021-10-01T00:00:00Z',
              },
              {
                id: '456',
                type: 'custom',
                selectable: false,
                deletable: false,
                description: 'Paywalled Sections',
                created_at: '2021-10-01T00:00:00Z',
              },
            ],
          }}
        />
        <SubscriptionTierCard
          className="w-full"
          subscriptionTier={{
            type: 'business',
            name: 'Business',
            price_amount: 9900,
            description:
              'Access to my Premium Posts for all your organization members',
            benefits: [
              {
                id: '123',
                type: 'articles',
                selectable: false,
                deletable: false,
                description: 'Premium Posts',
                created_at: '2021-10-01T00:00:00Z',
              },
              {
                id: '456',
                type: 'custom',
                selectable: false,
                deletable: false,
                description: 'Paywalled Sections',
                created_at: '2021-10-01T00:00:00Z',
              },
            ],
          }}
        />
      </div>
    </div>
  )
}
