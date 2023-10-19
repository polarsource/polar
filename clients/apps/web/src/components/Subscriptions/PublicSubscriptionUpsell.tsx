import { SubscriptionTier } from '@polar-sh/sdk'
import Link from 'next/link'
import { PrimaryButton } from 'polarkit/components/ui/atoms'
import SubscriptionTierCard from './SubscriptionTierCard'

interface PublicSubscriptionUpsellProps {
  subscriptionTiers: SubscriptionTier[]
  subscribePath: string
}

const PublicSubscriptionUpsell: React.FC<PublicSubscriptionUpsellProps> = ({
  subscriptionTiers,
  subscribePath,
}) => {
  return (
    <div className="flex flex-col py-6">
      <div className="flex flex-row items-center justify-between">
        <h2 className="flex flex-row items-center text-2xl">Subscriptions</h2>
        <PrimaryButton fullWidth={false}>View all Tiers</PrimaryButton>
      </div>
      <div className="flex flex-row gap-12 py-12">
        {subscriptionTiers
          .filter((tier) => tier.is_highlighted)
          .sort((a, b) => a.price_amount - b.price_amount)
          .map((tier) => (
            <Link
              href={{ pathname: subscribePath, query: { tier: tier.id } }}
              className="flex justify-between"
            >
              <SubscriptionTierCard subscriptionTier={tier} />
            </Link>
          ))}
      </div>
    </div>
  )
}

export default PublicSubscriptionUpsell
