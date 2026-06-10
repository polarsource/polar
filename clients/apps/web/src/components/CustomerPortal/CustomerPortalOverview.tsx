'use client'

import { usePortalAuthenticatedUser } from '@/hooks/queries/customerPortal'
import { createClientSideAPI } from '@/utils/client'
import { hasBillingPermission } from '@/utils/customerPortal'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import { schemas } from '@polar-sh/client'
import { usePortalTranslations } from './PortalLocaleProvider'
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
  const t = usePortalTranslations()
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

  const latestOrder = orders.at(0) ?? null

  const hasAnyActiveSubscriptions =
    activeOwnedSubscriptions.length > 0 || activeClaimedSubscriptions.length > 0

  return (
    <div className="flex flex-col gap-y-12">
      {/* Billing sections - only visible to users with billing permissions */}
      {canManageBilling && activeOwnedSubscriptions.length > 0 && (
        <div className="flex flex-col gap-y-12">
          <div className="flex flex-col gap-y-4">
            {activeOwnedSubscriptions.map((s) => (
              <CurrentPeriodOverview
                key={s.id}
                products={products}
                subscription={s}
                api={api}
              />
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
            <h3 className="text-xl">{t('portal.overview.teamSeatAccess.title')}</h3>
            <p className="dark:text-polar-500 text-gray-500">
              {t('portal.overview.teamSeatAccess.description')}
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
              canManageBilling
                ? t('portal.overview.emptyState.noActiveSubscriptions.title')
                : t('portal.overview.emptyState.noTeamAccess.title')
            }
            description={
              canManageBilling
                ? t(
                    'portal.overview.emptyState.noActiveSubscriptions.description',
                  )
                : t('portal.overview.emptyState.noTeamAccess.description')
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
