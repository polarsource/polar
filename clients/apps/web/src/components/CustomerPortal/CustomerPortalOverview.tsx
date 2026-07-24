'use client'

import { usePortalAuthenticatedUser } from '@/hooks/queries/customerPortal'
import { createClientSideAPI } from '@/utils/client'
import { hasBillingPermission } from '@/utils/customerPortal'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CurrentPeriodOverview } from './CurrentPeriodOverview'
import { CustomerPortalGrants } from './CustomerPortalGrants'
import { CustomerPortalOrders } from './CustomerPortalOrders'
import {
  ActiveSubscriptionsOverview,
  InactiveSubscriptionsOverview,
} from './CustomerPortalSubscriptions'
import { EmptyState } from '../Shared/EmptyState'
import { LatestPurchaseOverview } from './LatestPurchaseOverview'
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

  // A paused subscription is an ongoing relationship (it will resume), so it
  // belongs with the current subscriptions rather than the inactive ones.
  const isCurrentSubscription = (s: schemas['CustomerSubscription']) =>
    s.status === 'active' || s.status === 'trialing' || s.status === 'paused'

  const activeOwnedSubscriptions = subscriptions.filter(isCurrentSubscription)
  const inactiveOwnedSubscriptions = subscriptions.filter(
    (s) => !isCurrentSubscription(s),
  )

  const activeClaimedSubscriptions = claimedSubscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trialing',
  )

  const latestOrder = orders.at(0) ?? null

  const hasAnyActiveSubscriptions =
    activeOwnedSubscriptions.length > 0 || activeClaimedSubscriptions.length > 0

  return (
    <Box flexDirection="column" rowGap="3xl">
      {/* Billing sections - only visible to users with billing permissions */}
      {canManageBilling && activeOwnedSubscriptions.length > 0 && (
        <Box flexDirection="column" rowGap="3xl">
          <Box flexDirection="column" rowGap="l">
            {activeOwnedSubscriptions.map((s) => (
              <CurrentPeriodOverview
                key={s.id}
                products={products}
                subscription={s}
                api={api}
              />
            ))}
          </Box>
          <ActiveSubscriptionsOverview
            api={api}
            organization={organization}
            products={products}
            subscriptions={activeOwnedSubscriptions}
            customerSessionToken={customerSessionToken}
          />
        </Box>
      )}

      {/* Team Seat Access - visible to all users */}
      {activeClaimedSubscriptions.length > 0 && (
        <Box flexDirection="column" rowGap="l">
          <Box flexDirection="column" rowGap="s">
            <Text variant="heading-xs" as="h3">
              Team seat access
            </Text>
            <Text color="muted">Access provided through team subscription</Text>
          </Box>
          {activeClaimedSubscriptions.map((s) => (
            <Box
              key={s.id}
              justifyContent="between"
              borderRadius="l"
              backgroundColor="background-secondary"
              paddingHorizontal="xl"
              paddingVertical="l"
            >
              <Box flexDirection="column" rowGap="xs">
                <Text>{s.product.name}</Text>
                <Text color="muted">{s.product.organization.name}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {hasAnyActiveSubscriptions && canManageBilling && orders.length > 0 && (
        <CustomerPortalOrders
          organization={organization}
          orders={orders}
          customerSessionToken={customerSessionToken}
        />
      )}

      {!hasAnyActiveSubscriptions && canManageBilling && latestOrder && (
        <LatestPurchaseOverview order={latestOrder} />
      )}

      {!hasAnyActiveSubscriptions &&
        !(canManageBilling && orders.length > 0) && (
          <EmptyState
            icon={<AllInclusiveOutlined />}
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

      {/* Benefit Grants - visible to all users */}
      <CustomerPortalGrants api={api} />

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
    </Box>
  )
}
