import {
  Organization,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { useListAdminOrganizations } from 'polarkit/hooks'
import { useMemo } from 'react'
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
  const orgs = useListAdminOrganizations()

  const shouldRenderSubscribeButton = useMemo(
    () => !orgs.data?.items?.map((o) => o.id).includes(organization.id),
    [organization, orgs],
  )

  if (tiers.length < 1) {
    return null
  }

  return (
    <div className="flex flex-col gap-x-12 gap-y-8 py-12 lg:flex-row">
      <div className="w-full flex-shrink-0 md:w-64">
        <div className="flex items-center justify-between">
          <h2 className="flex flex-row items-center text-lg font-medium">
            <SubscriptionGroupIcon type={type} className="!h-6 !w-6" />
            <span className="dark:text-polar-50 ml-1">{title}</span>
          </h2>
        </div>
        <p className="dark:text-polar-500 mt-2 text-gray-500">{description}</p>
      </div>

      <div className="grid h-fit w-full grid-cols-1 gap-6 overflow-x-auto lg:mx-0 lg:overflow-x-visible xl:grid-cols-2">
        {tiers.map((tier) => (
          <SubscriptionTierCard
            className="w-full self-stretch"
            key={tier.id}
            subscriptionTier={tier}
            variant="small"
          >
            {shouldRenderSubscribeButton &&
              (tier.type === 'free' ? (
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
              ))}
          </SubscriptionTierCard>
        ))}
      </div>
    </div>
  )
}

export default SubscriptionGroupPublic
