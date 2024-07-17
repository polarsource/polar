import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useProducts } from '@/hooks/queries'
import { ArrowForwardOutlined, Bolt } from '@mui/icons-material'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'

export const SetupSubscriptions = () => {
  const { org } = useCurrentOrgAndRepoFromURL()
  const { data: products } = useProducts(org?.id ?? '')

  const hasPaidSubscriptionTiers = products?.items?.some(
    (tier) => tier.type === 'individual' || tier.type === 'business',
  )

  if (
    !org ||
    hasPaidSubscriptionTiers ||
    !org.feature_settings?.subscriptions_enabled
  )
    return null

  return (
    <div className="flex flex-col gap-y-8">
      <div className="flex grid-cols-2 flex-col gap-6 md:grid xl:grid-cols-3">
        <div className="col-span-2 flex flex-col gap-y-4 md:gap-y-6 md:py-6 lg:col-span-1">
          <Bolt
            className="hidden text-blue-500 md:block dark:text-blue-400"
            fontSize="large"
          />
          <h2 className="text-2xl font-bold">Subscription Tiers</h2>
          <p className="dark:text-polar-400 text-gray-600 [text-wrap:balance]">
            Create a few subscription tiers to offer your followers and
            supporters
          </p>
          <Link href={`/maintainer/${org?.slug}/products/new`}>
            <Button>
              <span>Create Tier</span>
              <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
            </Button>
          </Link>
        </div>
        <div className="col-span-2 flex grid-cols-1 flex-col gap-4 md:grid lg:grid-cols-3">
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
                  description: 'Public Newsletter',
                  created_at: '2021-10-01T00:00:00Z',
                  organization_id: '123',
                },
              ],
            }}
          />
          <SubscriptionTierCard
            className="w-full"
            subscriptionTier={{
              type: 'individual',
              name: 'Supporter',
              prices: [
                {
                  id: '123',
                  created_at: '2021-10-01T00:00:00Z',
                  is_archived: false,
                  price_amount: 500,
                  price_currency: 'usd',
                  type: 'recurring',
                  recurring_interval: 'month',
                },
              ],
              description: 'Exclusive insight into my coding endeavours',
              benefits: [
                {
                  id: '123',
                  type: 'articles',
                  selectable: false,
                  deletable: false,
                  description: 'Premium Newsletter',
                  created_at: '2021-10-01T00:00:00Z',
                  organization_id: '123',
                },
                {
                  id: '456',
                  type: 'custom',
                  selectable: false,
                  deletable: false,
                  description: 'Paywalled Sections',
                  created_at: '2021-10-01T00:00:00Z',
                  organization_id: '123',
                },
              ],
            }}
          />
          <SubscriptionTierCard
            className="w-full"
            subscriptionTier={{
              type: 'business',
              name: 'Business',
              prices: [
                {
                  id: '123',
                  created_at: '2021-10-01T00:00:00Z',
                  is_archived: false,
                  price_amount: 9900,
                  price_currency: 'usd',
                  type: 'recurring',
                  recurring_interval: 'month',
                },
              ],
              description:
                'Access to my Premium Newsletter for all your organization members',
              benefits: [
                {
                  id: '123',
                  type: 'articles',
                  selectable: false,
                  deletable: false,
                  description: 'Premium Newsletter',
                  created_at: '2021-10-01T00:00:00Z',
                  organization_id: '123',
                },
                {
                  id: '456',
                  type: 'custom',
                  selectable: false,
                  deletable: false,
                  description: 'Paywalled Sections',
                  created_at: '2021-10-01T00:00:00Z',
                  organization_id: '123',
                },
              ],
            }}
          />
        </div>
      </div>
    </div>
  )
}
