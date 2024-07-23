'use client'

import { FreeTierSubscribe } from '@/components/Organization/FreeTierSubscribe'
import CheckoutButton from '@/components/Products/CheckoutButton'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import SubscriptionTierRecurringIntervalSwitch from '@/components/Subscriptions/SubscriptionTierRecurringIntervalSwitch'
import { hasRecurringInterval } from '@/components/Subscriptions/utils'
import { useRecurringInterval } from '@/hooks/products'
import { useListMemberOrganizations } from '@/hooks/queries'
import { organizationPageLink } from '@/utils/nav'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { Organization, Product } from '@polar-sh/sdk'
import { redirect } from 'next/navigation'
import React, { useMemo } from 'react'

interface OrganizationSubscriptionsPublicPageProps {
  products: Product[]
  organization: Organization
}

const ClientPage: React.FC<OrganizationSubscriptionsPublicPageProps> = ({
  products,
  organization,
}) => {
  useTrafficRecordPageView({ organization })

  const orgs = useListMemberOrganizations()
  const [recurringInterval, setRecurringInterval, hasBothIntervals] =
    useRecurringInterval(products)

  const shouldRenderSubscribeButton = useMemo(
    () => !orgs.data?.items?.map((o) => o.id).includes(organization.id),
    [organization, orgs],
  )
  const showFreeTier = organization.profile_settings?.subscribe?.promote ?? true

  if (!organization.feature_settings?.subscriptions_enabled) {
    return redirect(organizationPageLink(organization))
  }

  return (
    <div className="flex flex-col gap-y-12">
      <div className="flex flex-col gap-y-2">
        <h2 className="text-xl">Subscriptions</h2>
        <p className="dark:text-polar-500 text-gray-500">
          Support {organization.name} with a subscription and receive unique
          benefits in return
        </p>
      </div>
      {hasBothIntervals && (
        <div className="flex justify-center">
          <SubscriptionTierRecurringIntervalSwitch
            recurringInterval={recurringInterval}
            onChange={setRecurringInterval}
          />
        </div>
      )}
      <div className="flex flex-row flex-wrap gap-8">
        {products
          .filter(hasRecurringInterval(recurringInterval, !showFreeTier))
          .map((tier) => (
            <SubscriptionTierCard
              className="w-full self-stretch md:max-w-[290px]"
              key={tier.id}
              subscriptionTier={tier}
              recurringInterval={recurringInterval}
            >
              {shouldRenderSubscribeButton &&
                (tier.type === 'free' ? (
                  <FreeTierSubscribe
                    product={tier}
                    organization={organization}
                  />
                ) : (
                  <CheckoutButton
                    organization={organization}
                    recurringInterval={recurringInterval}
                    product={tier}
                    checkoutPath="/api/checkout"
                  >
                    Subscribe
                  </CheckoutButton>
                ))}
            </SubscriptionTierCard>
          ))}
      </div>
    </div>
  )
}

export default ClientPage
