'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  useCustomerCancelSubscription,
  useCustomerClearPendingSubscriptionUpdate,
  useCustomerOrders,
  useCustomerPauseSubscription,
  useCustomerResumeSubscription,
  usePortalAuthenticatedUser,
} from '@/hooks/queries/customerPortal'
import { useRequirePaymentMethod } from '@/hooks/useRequirePaymentMethod'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { hasBillingPermission } from '@/utils/customerPortal'
import { getUnitLabels, isUnitBasedPrice } from '@/utils/product'
import { getPauseAction } from '@/utils/subscription'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useModal } from '../Modal/useModal'
import { DownloadInvoicePortal } from '../Orders/DownloadInvoice'
import CustomerCancellationModal from './CustomerCancellationModal'
import CustomerPauseSubscriptionModal from './CustomerPauseSubscriptionModal'
import { CustomerPortalGrants } from './CustomerPortalGrants'
import { PortalConfirmDialog } from './PortalDialog'
import { CustomerSubscriptionHeader } from './CustomerSubscriptionHeader'
import { CustomerUnitQuantityManager } from './CustomerUnitQuantityManager'
import {
  PortalCardList,
  PortalListItem,
  PortalRow,
  PortalRows,
  PortalSection,
  PortalText,
} from './PortalPrimitives'
import { PendingUpdateRows, SubscriptionDateRows } from './SubscriptionDateRows'
import { SeatManagementTable } from './SeatManagementTable'

const CustomerPortalSubscription = ({
  api,
  customerSessionToken,
  subscription,
  products,
}: {
  api: Client
  customerSessionToken: string
  subscription: schemas['CustomerSubscription']
  products: schemas['CustomerProduct'][]
}) => {
  const {
    show: showCancelModal,
    hide: hideCancelModal,
    isShown: cancelModalIsShown,
  } = useModal()

  const {
    show: showPauseModal,
    hide: hidePauseModal,
    isShown: pauseModalIsShown,
  } = useModal()

  const [showClearPendingUpdateModal, setShowClearPendingUpdateModal] =
    useState(false)

  // Get authenticated user to check billing permissions
  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)
  const canManageBilling = hasBillingPermission(authenticatedUser)

  const { data: orders, refetch: refetchOrders } = useCustomerOrders(api, {
    subscription_id: subscription.id,
    limit: 100,
    sorting: ['-created_at'],
  })

  const router = useRouter()

  const cancelSubscription = useCustomerCancelSubscription(api)
  const clearPendingUpdate = useCustomerClearPendingSubscriptionUpdate(api)
  const pauseSubscription = useCustomerPauseSubscription(api)
  const resumeSubscription = useCustomerResumeSubscription(api)
  const { withPaymentMethod, isPending: paymentMethodsPending } =
    useRequirePaymentMethod(api, customerSessionToken, subscription)

  const pendingUpdate = subscription.pending_update

  const hasInvoices = orders?.items && orders.items.length > 0

  const isCancelled = !!(
    subscription.cancel_at_period_end || subscription.ended_at
  )

  // Seats management
  const hasSeatBasedPricing = subscription.prices.some(
    (price) => price.amount_type === 'seat_based',
  )

  const unitPrice = subscription.prices.find(isUnitBasedPrice)
  const { unitLabel, unitLabelPlural } = getUnitLabels(unitPrice)

  // Check customer portal settings for seat management visibility
  const portalSettings =
    subscription.product.organization.customer_portal_settings
  const showSeatManagement = portalSettings.subscription.update_seats === true
  const showUnitManagement = portalSettings.subscription.update_units === true
  const showPauseResume = portalSettings.subscription.pause === true

  const pauseAction = getPauseAction(subscription)

  const showCancelAction = !isCancelled && canManageBilling
  const showPauseAction =
    showPauseResume && canManageBilling && pauseAction !== null

  const handleCancelScheduledPause = async () => {
    try {
      await pauseSubscription.mutateAsync({
        id: subscription.id,
        body: { pause_at_period_end: false },
      })
      router.refresh()
      toast({
        title: 'Scheduled pause canceled',
        description:
          'Your subscription will no longer be paused at the end of the period.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to cancel the scheduled pause: ${extractApiErrorMessage(error as Record<string, unknown>)}`,
      })
    }
  }

  const handleResume = async () =>
    withPaymentMethod(async () => {
      try {
        await resumeSubscription.mutateAsync({ id: subscription.id })
        router.refresh()
        toast({
          title: 'Subscription resumed',
          description: 'Your subscription has been resumed.',
        })
      } catch (error) {
        toast({
          title: 'Error',
          description: `Failed to resume the subscription: ${extractApiErrorMessage(error as Record<string, unknown>)}`,
        })
      }
    })

  return (
    <Box flexDirection="column" rowGap="3xl">
      <Box flexDirection="column" rowGap="xl">
        <CustomerSubscriptionHeader subscription={subscription} />
        <PortalRows>
          {subscription.units !== null && (
            <PortalRow
              label={
                <span className="capitalize">
                  {subscription.units === 1 ? unitLabel : unitLabelPlural}
                </span>
              }
              value={subscription.units}
              numeric
            />
          )}
          <SubscriptionDateRows subscription={subscription} />
        </PortalRows>

        {(showCancelAction || showPauseAction) && (
          <Box columnGap="s" rowGap="s" flexWrap="wrap" justifyContent="end">
            {showCancelAction && (
              <Button variant="secondary" onClick={showCancelModal}>
                Cancel subscription
              </Button>
            )}
            {showPauseAction &&
              (pauseAction === 'resume' ? (
                <Button
                  onClick={handleResume}
                  loading={
                    resumeSubscription.isPending || paymentMethodsPending
                  }
                  disabled={
                    resumeSubscription.isPending || paymentMethodsPending
                  }
                >
                  Resume subscription
                </Button>
              ) : pauseAction === 'cancel_scheduled_pause' ? (
                <Button
                  variant="secondary"
                  onClick={handleCancelScheduledPause}
                  loading={pauseSubscription.isPending}
                >
                  Cancel scheduled pause
                </Button>
              ) : (
                <Button variant="secondary" onClick={showPauseModal}>
                  Pause subscription
                </Button>
              ))}
          </Box>
        )}
      </Box>

      {pendingUpdate && (
        <PortalSection
          title="Scheduled change"
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowClearPendingUpdateModal(true)}
              loading={clearPendingUpdate.isPending}
            >
              Cancel change
            </Button>
          }
        >
          <PortalRows>
            <PendingUpdateRows
              subscription={subscription}
              products={products}
            />
          </PortalRows>
        </PortalSection>
      )}

      {hasSeatBasedPricing && showSeatManagement && canManageBilling && (
        <SeatManagementTable
          api={api}
          identifier={{ subscriptionId: subscription.id }}
          organizationSlug={subscription.product.organization.slug}
          prorationBehavior={
            subscription.product.organization.proration_behavior
          }
        />
      )}

      {unitPrice && showUnitManagement && canManageBilling && !isCancelled && (
        <CustomerUnitQuantityManager
          api={api}
          subscription={subscription}
          unitPrice={unitPrice}
          prorationBehavior={
            subscription.product.organization.proration_behavior
          }
          onUpdate={() => router.refresh()}
        />
      )}

      <CustomerPortalGrants api={api} subscriptionId={subscription.id} />

      {hasInvoices && (
        <PortalSection title="Invoices">
          <PortalCardList>
            {orders.items.map((order) => (
              <PortalListItem
                key={order.id}
                title={
                  <FormattedDateTime
                    datetime={order.created_at}
                    dateStyle="medium"
                    resolution="day"
                  />
                }
                subtitle={order.invoice_number}
                meta={
                  <PortalText tone="primary" className="tabular-nums">
                    {formatCurrency('compact')(
                      order.total_amount,
                      order.currency,
                    )}
                  </PortalText>
                }
                actions={
                  <DownloadInvoicePortal
                    customerSessionToken={customerSessionToken}
                    order={order}
                    onInvoiceGenerated={refetchOrders}
                    dropdown
                  />
                }
              />
            ))}
          </PortalCardList>
        </PortalSection>
      )}

      <CustomerCancellationModal
        api={api}
        subscription={subscription}
        isShown={cancelModalIsShown}
        hide={hideCancelModal}
        cancelSubscription={cancelSubscription}
      />

      <CustomerPauseSubscriptionModal
        isShown={pauseModalIsShown}
        hide={hidePauseModal}
        api={api}
        subscription={subscription}
        onPause={hidePauseModal}
      />

      <PortalConfirmDialog
        isShown={showClearPendingUpdateModal}
        hide={() => setShowClearPendingUpdateModal(false)}
        title="Cancel scheduled change?"
        description="Your subscription will stay as it is on the next billing cycle."
        cancelText="Keep change"
        confirmText="Cancel change"
        onConfirm={async () => {
          await clearPendingUpdate.mutateAsync(subscription.id)
          refetchOrders()
        }}
      />
    </Box>
  )
}

export default CustomerPortalSubscription
