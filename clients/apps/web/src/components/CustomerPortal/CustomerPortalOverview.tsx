'use client'

import { createClientSideAPI } from '@/utils/client'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import { schemas } from '@polar-sh/client'
import { CurrentPeriodOverview } from './CurrentPeriodOverview'
import { CustomerPortalGrants } from './CustomerPortalGrants'
import {
  ActiveSubscriptionsOverview,
  InactiveSubscriptionsOverview,
} from './CustomerPortalSubscriptions'
import { EmptyState } from './EmptyState'
export interface CustomerPortalProps {
  organization: schemas['CustomerOrganization']
  products: schemas['CustomerProduct'][]
  subscriptions: schemas['CustomerSubscription'][]
  claimedSubscriptions: schemas['CustomerSubscription'][]
  benefitGrants: schemas['CustomerBenefitGrant'][]
  customerSessionToken: string
}

export const CustomerPortalOverview = ({
  organization,
  products,
  subscriptions,
  claimedSubscriptions,
  benefitGrants,
  customerSessionToken,
}: CustomerPortalProps) => {
  const api = createClientSideAPI(customerSessionToken)

  const activeOwnedSubscriptions = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trialing',
  )
  const inactiveOwnedSubscriptions = subscriptions.filter(
    (s) => s.status !== 'active' && s.status !== 'trialing',
  )

  const activeClaimedSubscriptions = claimedSubscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trialing',
  )

  const hasAnyActiveSubscriptions =
    activeOwnedSubscriptions.length > 0 || activeClaimedSubscriptions.length > 0

  return (
    <div className="flex flex-col gap-y-12">
      {activeOwnedSubscriptions.length > 0 && (
        <div className="flex flex-col gap-y-6">
          {activeClaimedSubscriptions.length > 0 && (
            <h3 className="text-xl">Your Subscriptions</h3>
          )}
          <div className="flex flex-col gap-y-4">
            {activeOwnedSubscriptions.map((s) => (
              <CurrentPeriodOverview key={s.id} subscription={s} api={api} />
            ))}
          </div>
          <ActiveSubscriptionsOverview
            api={api}
            organization={organization}
            products={products}
            subscriptions={activeOwnedSubscriptions}
            customerSessionToken={customerSessionToken}
          />
        </div>
      )}

      {activeClaimedSubscriptions.length > 0 && (
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-xl">Team Seat Access</h3>
            <p className="dark:text-polar-500 text-gray-500">
              Access provided through team subscription
            </p>
          </div>
          {activeClaimedSubscriptions.map((s) => (
            <div
              key={s.id}
              className="dark:bg-polar-900 flex justify-between rounded-2xl bg-gray-50 px-6 py-4"
            >
              <div className="flex flex-col gap-1">
                <span>{s.product.name}</span>
                <span className="dark:text-polar-500 text-sm text-gray-500">
                  {s.product.organization.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasAnyActiveSubscriptions && (
        <EmptyState
          icon={<AllInclusiveOutlined />}
          title="No Active Subscriptions"
          description="You don't have any active subscriptions at the moment."
        />
      )}

      {benefitGrants.length > 0 ? (
        <CustomerPortalGrants
          organization={organization}
          benefitGrants={benefitGrants}
          api={api}
        />
      ) : null}

      {inactiveOwnedSubscriptions.length > 0 && (
        <InactiveSubscriptionsOverview
          organization={organization}
          subscriptions={inactiveOwnedSubscriptions}
          api={api}
          customerSessionToken={customerSessionToken}
          products={products}
        />
      )}
    </div>
  )
}
