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
import { extractApiErrorMessage } from '@/utils/api/errors'
import { hasBillingPermission } from '@/utils/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Button } from '@polar-sh/orbit'
import { DataTable } from '@polar-sh/orbit'
import { InlineModal } from '@polar-sh/orbit'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { useModal } from '../Modal/useModal'
import { DownloadInvoicePortal } from '../Orders/DownloadInvoice'
import AmountLabel from '../Shared/AmountLabel'
import { DetailItem } from '../Shared/Section'
import CustomerCancellationModal from './CustomerCancellationModal'
import CustomerPauseSubscriptionModal from './CustomerPauseSubscriptionModal'
import {
  getPauseAction,
  getScheduleRows,
} from '../Subscriptions/subscriptionState'
import { SubscriptionStatusLabel } from '../Subscriptions/utils'
import { CustomerPortalGrants } from './CustomerPortalGrants'
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

  const pendingUpdate = subscription.pending_update
  const pendingProduct = products.find(
    (product) => product.id === pendingUpdate?.product_id,
  )

  const hasInvoices = orders?.items && orders.items.length > 0

  const isCancelled = !!(
    subscription.cancel_at_period_end || subscription.ended_at
  )

  // Seats management
  const hasSeatBasedPricing = subscription.prices.some(
    (price) => price.amount_type === 'seat_based',
  )

  // Check customer portal settings for seat management visibility
  const portalSettings =
    subscription.product.organization.customer_portal_settings
  const showSeatManagement = portalSettings.subscription.update_seats === true
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
        title: 'Scheduled Pause Canceled',
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

  const handleResume = async () => {
    try {
      await resumeSubscription.mutateAsync({ id: subscription.id })
      router.refresh()
      toast({
        title: 'Subscription Resumed',
        description: 'Your subscription has been resumed.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to resume the subscription: ${extractApiErrorMessage(error as Record<string, unknown>)}`,
      })
    }
  }

  return (
    <Box flexDirection="column" rowGap="2xl">
      <Text variant="heading-xs" as="h3">
        {subscription.product.name}
      </Text>

      <Box flexDirection="column">
        <DetailItem
          label="Amount"
          value={
            subscription.amount && subscription.currency ? (
              <AmountLabel
                amount={subscription.amount}
                currency={subscription.currency}
                interval={subscription.recurring_interval}
                intervalCount={subscription.recurring_interval_count}
              />
            ) : (
              'Free'
            )
          }
        />
        <DetailItem
          label="Status"
          value={<SubscriptionStatusLabel subscription={subscription} />}
        />
        {subscription.started_at && (
          <DetailItem
            label="Started"
            value={
              <Text as="span">
                <FormattedDateTime
                  datetime={subscription.started_at}
                  dateStyle="long"
                  resolution="day"
                />
              </Text>
            }
          />
        )}
        {getScheduleRows(subscription).map((row) => (
          <DetailItem
            key={row.key}
            label={row.label}
            value={
              row.datetime ? (
                <Text as="span">
                  <FormattedDateTime
                    datetime={row.datetime}
                    dateStyle="long"
                    resolution="day"
                  />
                </Text>
              ) : (
                row.fallback
              )
            }
          />
        ))}
      </Box>

      {pendingUpdate && (
        <Box flexDirection="column" rowGap="s">
          <Box alignItems="center" justifyContent="between" columnGap="m">
            <Text variant="heading-xxs" as="h3">
              Pending update
            </Text>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowClearPendingUpdateModal(true)}
              loading={clearPendingUpdate.isPending}
            >
              Cancel scheduled change
            </Button>
          </Box>
          <Box flexDirection="column">
            {pendingProduct && (
              <DetailItem
                label="New product"
                value={`${subscription.product.name} → ${pendingProduct.name}`}
              />
            )}
            {pendingUpdate.seats !== null && (
              <DetailItem
                label="Seats"
                value={`${subscription.seats} → ${pendingUpdate.seats}`}
              />
            )}
            <DetailItem
              label="Update in effect from"
              value={
                <Text as="span">
                  <FormattedDateTime
                    datetime={pendingUpdate.applies_at}
                    dateStyle="long"
                  />
                </Text>
              }
            />
          </Box>
        </Box>
      )}

      {/* Cancel + pause/resume actions, gated by billing permissions */}
      {(showCancelAction || showPauseAction) && (
        <Box flexDirection="column" rowGap="s">
          {showCancelAction && (
            <Button
              variant="secondary"
              fullWidth
              onClick={showCancelModal}
              aria-label="Cancel subscription"
            >
              Cancel Subscription
            </Button>
          )}
          {showPauseAction &&
            (pauseAction === 'resume' ? (
              <Button
                variant="secondary"
                fullWidth
                onClick={handleResume}
                loading={resumeSubscription.isPending}
                aria-label="Resume subscription"
              >
                Resume Subscription
              </Button>
            ) : pauseAction === 'cancel_scheduled_pause' ? (
              <Button
                variant="secondary"
                fullWidth
                onClick={handleCancelScheduledPause}
                loading={pauseSubscription.isPending}
                aria-label="Cancel scheduled pause"
              >
                Cancel Scheduled Pause
              </Button>
            ) : (
              <Button
                variant="secondary"
                fullWidth
                onClick={showPauseModal}
                aria-label="Pause subscription"
              >
                Pause Subscription
              </Button>
            ))}
        </Box>
      )}

      {/* Seat management - only shown for users with billing permissions */}
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

      <CustomerPortalGrants api={api} subscriptionId={subscription.id} />

      {hasInvoices && (
        <Box flexDirection="column" rowGap="l" width="100%">
          <Text variant="heading-xxs" as="h3">
            Invoices
          </Text>
          <DataTable
            data={orders.items ?? []}
            isLoading={false}
            columns={[
              {
                accessorKey: 'created_at',
                header: 'Date',
                cell: ({ row }) => (
                  <FormattedDateTime
                    datetime={row.original.created_at}
                    dateStyle="medium"
                    resolution="day"
                  />
                ),
              },
              {
                accessorKey: 'amount',
                header: 'Amount',
                cell: ({ row }) => (
                  <Text as="span" color="muted" tabularNums>
                    {formatCurrency('compact')(
                      row.original.total_amount,
                      row.original.currency,
                    )}
                  </Text>
                ),
              },
              {
                accessorKey: 'id',
                header: '',
                cell: ({ row }) => (
                  <Box justifyContent="end">
                    <DownloadInvoicePortal
                      customerSessionToken={customerSessionToken}
                      order={row.original}
                      onInvoiceGenerated={refetchOrders}
                      dropdown
                    />
                  </Box>
                ),
              },
            ]}
          />
        </Box>
      )}

      <CustomerCancellationModal
        api={api}
        subscription={subscription}
        isShown={cancelModalIsShown}
        hide={hideCancelModal}
        cancelSubscription={cancelSubscription}
      />

      <InlineModal
        isShown={pauseModalIsShown}
        hide={hidePauseModal}
        modalContent={
          <CustomerPauseSubscriptionModal
            api={api}
            subscription={subscription}
            onPause={hidePauseModal}
          />
        }
      />

      <ConfirmModal
        isShown={showClearPendingUpdateModal}
        hide={() => setShowClearPendingUpdateModal(false)}
        title="Cancel scheduled change"
        description="Your subscription will remain unchanged on the next billing cycle. Are you sure you want to cancel this pending update?"
        onConfirm={async () => {
          await clearPendingUpdate.mutateAsync(subscription.id)
          refetchOrders()
        }}
      />
    </Box>
  )
}

export default CustomerPortalSubscription
