'use client'

import { usePortalAuthenticatedUser } from '@/hooks/queries/customerPortal'
import { createClientSideAPI } from '@/utils/client'
import { hasBillingPermission } from '@/utils/customerPortal'
import { isListableCustomerOrder } from '@/utils/order'
import { schemas } from '@polar-sh/client'
import { CustomerPortalGrants } from './CustomerPortalGrants'
import { CustomerPortalOrders } from './CustomerPortalOrders'
import {
  ActiveSubscriptionsOverview,
  InactiveSubscriptionsOverview,
} from './CustomerPortalSubscriptions'
import { LatestPurchaseOverview } from './LatestPurchaseOverview'
import {
  PortalCardList,
  PortalEmptyState,
  PortalListItem,
  PortalPageHeader,
  PortalSection,
} from './PortalPrimitives'

export interface CustomerPortalProps {
  organization: schemas['CustomerOrganization']
  products: schemas['CustomerProduct'][]
  subscriptions: schemas['CustomerSubscription'][]
  claimedSubscriptions: schemas['CustomerSubscription'][]
  orders: schemas['CustomerOrder'][]
  customerSessionToken: string
}

export const CustomerPortalOverview = ({
  organization,
  products,
  subscriptions,
  claimedSubscriptions,
  orders,
  customerSessionToken,
}: CustomerPortalProps) => {
  const api = createClientSideAPI(customerSessionToken)

  // Check if the user has billing permissions
  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)
  const canManageBilling = hasBillingPermission(authenticatedUser)

  // Paused, past-due and trial-ended subscriptions are ongoing relationships
  // (they resume, recover or reactivate), so they belong with the current
  // subscriptions.
  const isCurrentSubscription = (s: schemas['CustomerSubscription']) =>
    s.status === 'active' ||
    s.status === 'trialing' ||
    s.status === 'paused' ||
    s.status === 'past_due' ||
    s.status === 'trial_ended'

  const activeOwnedSubscriptions = subscriptions.filter(isCurrentSubscription)
  const inactiveOwnedSubscriptions = subscriptions.filter(
    (s) => !isCurrentSubscription(s),
  )

  const activeClaimedSubscriptions = claimedSubscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trialing',
  )

  const nonDraftOrders = orders.filter(isListableCustomerOrder)
  const latestOrder = nonDraftOrders.at(0) ?? null

  const hasAnyActiveSubscriptions =
    activeOwnedSubscriptions.length > 0 || activeClaimedSubscriptions.length > 0

  return (
    <>
      <PortalPageHeader
        title="Overview"
        description={
          authenticatedUser?.name
            ? `Welcome back, ${authenticatedUser.name}`
            : 'Your subscriptions, orders and benefits'
        }
      />

      {canManageBilling && activeOwnedSubscriptions.length > 0 && (
        <ActiveSubscriptionsOverview
          api={api}
          organization={organization}
          products={products}
          subscriptions={activeOwnedSubscriptions}
          customerSessionToken={customerSessionToken}
        />
      )}

      {activeClaimedSubscriptions.length > 0 && (
        <PortalSection
          title="Team access"
          description="Access provided through a team subscription"
        >
          <PortalCardList>
            {activeClaimedSubscriptions.map((s) => (
              <PortalListItem
                key={s.id}
                title={s.product.name}
                subtitle={s.product.organization.name}
              />
            ))}
          </PortalCardList>
        </PortalSection>
      )}

      {!hasAnyActiveSubscriptions && canManageBilling && latestOrder && (
        <LatestPurchaseOverview order={latestOrder} />
      )}

      {!hasAnyActiveSubscriptions &&
        !(canManageBilling && nonDraftOrders.length > 0) && (
          <PortalEmptyState
            title={
              canManageBilling ? 'No active subscriptions' : 'No team access'
            }
            description={
              canManageBilling
                ? "You don't have any active subscriptions at the moment."
                : "You don't have any team seat access at the moment."
            }
          />
        )}

      <CustomerPortalGrants api={api} />

      {hasAnyActiveSubscriptions &&
        canManageBilling &&
        nonDraftOrders.length > 0 && (
          <CustomerPortalOrders
            organization={organization}
            orders={nonDraftOrders}
            customerSessionToken={customerSessionToken}
            limit={5}
          />
        )}

      {canManageBilling && inactiveOwnedSubscriptions.length > 0 && (
        <InactiveSubscriptionsOverview
          organization={organization}
          subscriptions={inactiveOwnedSubscriptions}
          api={api}
          customerSessionToken={customerSessionToken}
          products={products}
        />
      )}
    </>
  )
}
