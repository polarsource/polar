'use client'

import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { CurrentPeriodOverview } from './CurrentPeriodOverview'
import { CustomerPortalGrants } from './CustomerPortalGrants'
import {
  ActiveSubscriptionsOverview,
  InactiveSubscriptionsOverview,
} from './CustomerPortalSubscriptions'
export interface CustomerPortalProps {
  organization: schemas['Organization']
  products: schemas['CustomerProduct'][]
  subscriptions: schemas['CustomerSubscription'][]
  benefitGrants: schemas['CustomerBenefitGrant'][]
  customerSessionToken: string
}

export const CustomerPortalOverview = ({
  organization,
  products,
  subscriptions,
  benefitGrants,
  customerSessionToken,
}: CustomerPortalProps) => {
  const api = createClientSideAPI(customerSessionToken)

  const activeSubscriptions = subscriptions.filter((s) => s.status === 'active')
  const inactiveSubscriptions = subscriptions.filter(
    (s) => s.status !== 'active',
  )

  return (
    <div className="flex flex-col gap-y-16">
      {activeSubscriptions.length > 0 && (
        <div className="flex flex-col gap-y-4">
          {activeSubscriptions.map((s) => (
            <CurrentPeriodOverview key={s.id} subscription={s} />
          ))}
        </div>
      )}

      {activeSubscriptions.length > 0 && (
        <ActiveSubscriptionsOverview
          api={api}
          organization={organization}
          products={products}
          subscriptions={activeSubscriptions}
          customerSessionToken={customerSessionToken}
        />
      )}

      {benefitGrants.length > 0 && (
        <CustomerPortalGrants
          organization={organization}
          benefitGrants={benefitGrants}
          api={api}
        />
      )}

      {inactiveSubscriptions.length > 0 && (
        <InactiveSubscriptionsOverview
          organization={organization}
          subscriptions={inactiveSubscriptions}
          api={api}
          customerSessionToken={customerSessionToken}
          products={products}
        />
      )}
    </div>
  )
}
