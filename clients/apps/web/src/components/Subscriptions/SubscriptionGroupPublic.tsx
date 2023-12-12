import {
  Organization,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
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
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="flex flex-row items-center text-lg font-medium">
            <SubscriptionGroupIcon type={type} className="!h-6 !w-6" />
            <span className="dark:text-polar-50 ml-2">{title}</span>
          </h2>
        </div>
        <p className="dark:text-polar-500 mt-2 text-gray-500">{description}</p>
      </div>

      <div className="-mx-10 flex h-fit flex-row flex-wrap gap-6 overflow-x-auto px-10 py-6 lg:mx-0 lg:overflow-x-visible lg:px-0 lg:py-2">
        {tiers.map((tier) => (
          <SubscriptionTierCard
            className="w-full self-stretch lg:max-w-[250px]"
            key={tier.id}
            subscriptionTier={tier}
            variant="small"
          >
            <SubscriptionTierSubscribeButton
              organization={organization}
              subscriptionTier={tier}
              subscribePath={subscribePath}
            />
          </SubscriptionTierCard>
        ))}
      </div>
    </div>
  )
}

export default SubscriptionGroupPublic
