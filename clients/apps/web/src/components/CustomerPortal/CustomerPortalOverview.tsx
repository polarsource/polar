'use client'

import { usePortalAuthenticatedUser } from '@/hooks/queries'
import { createClientSideAPI } from '@/utils/client'
import { hasBillingPermission } from '@/utils/customerPortal'
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
  customerSessionToken: string
}

export const CustomerPortalOverview = ({
  organization,
  products,
  subscriptions,
  claimedSubscriptions,
  customerSessionToken,
}: CustomerPortalProps) => {
  const api = createClientSideAPI(customerSessionToken)

  // Check if the user has billing permissions
  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)
  const canManageBilling = hasBillingPermission(authenticatedUser)

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
      {/* Billing sections - only visible to users with billing permissions */}
      {canManageBilling && activeOwnedSubscriptions.length > 0 && (
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

      {/* Team Seat Access - visible to all users */}
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

      {/* Empty state - adjusted based on permissions */}
      {!hasAnyActiveSubscriptions && (
        <EmptyState
          icon={<AllInclusiveOutlined />}
          title={
            canManageBilling ? 'No Active Subscriptions' : 'No Team Access'
          }
          description={
            canManageBilling
              ? "You don't have any active subscriptions at the moment."
              : "You don't have any team seat access at the moment."
          }
        />
      )}

      {/* Benefit Grants - visible to all users */}
      <CustomerPortalGrants organization={organization} api={api} />

      {/* Inactive subscriptions - only visible to users with billing permissions */}
      {canManageBilling && inactiveOwnedSubscriptions.length > 0 && (
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
