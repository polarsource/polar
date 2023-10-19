import { SubscriptionTier } from '@polar-sh/sdk'
import Link from 'next/link'
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
    <div className="flex flex-row gap-4">
      {subscriptionTiers
        .filter((tier) => tier.is_highlighted)
        .map((tier) => (
          <Link
            href={{ pathname: subscribePath, query: { tier: tier.id } }}
            className="flex justify-between"
          >
            <SubscriptionTierCard subscriptionTier={tier} />
          </Link>
        ))}
    </div>
  )
}

export default PublicSubscriptionUpsell
