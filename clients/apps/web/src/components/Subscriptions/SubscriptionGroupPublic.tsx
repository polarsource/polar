import {
  Organization,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { FreeTierSubscribe } from '../Organization/FreeTierSubscribe'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'
import SubscriptionTierCard from './SubscriptionTierCard'
import SubscriptionTierSubscribeButton from './SubscriptionTierSubscribeButton'

interface SubscriptionGroupPublicProps {
  title: string
  description: string
  type: SubscriptionTierType
  tiers: SubscriptionTier[]
  organization: Organization
  subscribePath: string
}

const SubscriptionGroupPublic = ({
  title,
  description,
  type,
  tiers,
  organization,
  subscribePath,
}: SubscriptionGroupPublicProps) => {
  if (tiers.length < 1) {
    return null
  }

  return (
    <div className="flex flex-row gap-12 py-12">
      <div className="w-64 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="flex flex-row items-center text-lg font-medium">
            <SubscriptionGroupIcon type={type} className="!h-6 !w-6" />
            <span className="dark:text-polar-50 ml-1">{title}</span>
          </h2>
        </div>
        <p className="dark:text-polar-500 mt-2 text-gray-500">{description}</p>
      </div>

      <div className="grid h-fit w-full grid-cols-2 gap-6 overflow-x-auto lg:mx-0 lg:overflow-x-visible">
        {tiers.map((tier) => (
          <SubscriptionTierCard
            className="w-full self-stretch"
            key={tier.id}
            subscriptionTier={tier}
            variant="small"
          >
            {tier.type === 'free' ? (
              <FreeTierSubscribe
                subscriptionTier={tier}
                organization={organization}
              />
            ) : (
              <SubscriptionTierSubscribeButton
                organization={organization}
                subscriptionTier={tier}
                subscribePath={subscribePath}
              />
            )}
          </SubscriptionTierCard>
        ))}
      </div>
    </div>
  )
}

export default SubscriptionGroupPublic
