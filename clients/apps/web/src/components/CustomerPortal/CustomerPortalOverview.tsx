'use client'

import { createClientSideAPI } from '@/utils/client'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import DiamondOutlined from '@mui/icons-material/DiamondOutlined'
import { schemas } from '@polar-sh/client'
import { CurrentPeriodOverview } from './CurrentPeriodOverview'
import { CustomerPortalGrants } from './CustomerPortalGrants'
import {
  ActiveSubscriptionsOverview,
  InactiveSubscriptionsOverview,
} from './CustomerPortalSubscriptions'
import { EmptyState } from './EmptyState'
export interface CustomerPortalProps {
  organization: schemas['Organization']
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
          <h3 className="text-xl">Team Seat Access</h3>
          <div className="dark:border-polar-700 dark:bg-polar-900 flex flex-col gap-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-6">
            {activeClaimedSubscriptions.map((s) => (
              <div
                key={s.id}
                className="dark:bg-polar-800 flex items-center justify-between rounded-lg bg-white p-4"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{s.product.name}</span>
                  <span className="dark:text-polar-500 text-sm text-gray-500">
                    {s.product.organization.name}
                  </span>
                </div>
                <span className="dark:bg-polar-700 dark:text-polar-300 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                  Team Seat
                </span>
              </div>
            ))}
          </div>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Access provided through team subscription. Contact your team admin
            to manage these subscriptions.
          </p>
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
      ) : (
        <EmptyState
          icon={<DiamondOutlined />}
          title="No Benefits Available"
          description="You don't have any benefit grants available right now."
        />
      )}

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
