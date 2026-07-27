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
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { useModal } from '../Modal/useModal'
import { DownloadInvoicePortal } from '../Orders/DownloadInvoice'
import AmountLabel from '../Shared/AmountLabel'
import { DetailRow } from '../Shared/DetailRow'
import CustomerCancellationModal from './CustomerCancellationModal'
import CustomerPauseSubscriptionModal from './CustomerPauseSubscriptionModal'
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

  const pauseAction: 'resume' | 'cancel_scheduled_pause' | 'pause' | null =
    subscription.status === 'paused'
      ? 'resume'
      : subscription.pause_at_period_end && !isCancelled
        ? 'cancel_scheduled_pause'
        : !isCancelled && subscription.status === 'active'
          ? 'pause'
          : null

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
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-xl">{subscription.product.name}</h3>
      </div>

      <div className="flex flex-col text-sm">
        <DetailRow
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
        <DetailRow
          label="Status"
          value={<SubscriptionStatusLabel subscription={subscription} />}
        />
        {subscription.started_at && (
          <DetailRow
            label="Start Date"
            value={
              <FormattedDateTime
                datetime={subscription.started_at}
                dateStyle="long"
                resolution="day"
              />
            }
          />
        )}
        {!subscription.ended_at &&
          subscription.status !== 'paused' &&
          subscription.current_period_end && (
            <DetailRow
              label={
                subscription.cancel_at_period_end
                  ? 'Expiry Date'
                  : subscription.pause_at_period_end
                    ? 'Pauses on'
                    : 'Renewal Date'
              }
              value={
                <FormattedDateTime
                  datetime={subscription.current_period_end}
                  dateStyle="long"
                  resolution="day"
                />
              }
            />
          )}
        {subscription.status === 'paused' && subscription.paused_at && (
          <DetailRow
            label="Paused on"
            value={
              <FormattedDateTime
                datetime={subscription.paused_at}
                dateStyle="long"
                resolution="day"
              />
            }
          />
        )}
        {(subscription.status === 'paused' ||
          subscription.pause_at_period_end) && (
          <DetailRow
            label="Resumes on"
            value={
              subscription.resumes_at ? (
                <FormattedDateTime
                  datetime={subscription.resumes_at}
                  dateStyle="long"
                  resolution="day"
                />
              ) : (
                'Until resumed'
              )
            }
          />
        )}
        {subscription.ended_at && (
          <DetailRow
            label="Expired"
            value={
              <FormattedDateTime
                datetime={subscription.ended_at}
                dateStyle="long"
                resolution="day"
              />
            }
          />
        )}
      </div>

      {pendingUpdate && (
        <div className="flex flex-col gap-y-2">
          <div className="flex flex-row items-center justify-between">
            <h3>Pending Update</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowClearPendingUpdateModal(true)}
              loading={clearPendingUpdate.isPending}
            >
              Cancel scheduled change
            </Button>
          </div>
          <div className="flex flex-col">
            {pendingProduct && (
              <DetailRow
                label="New Product"
                value={`${subscription.product.name} -> ${pendingProduct?.name}`}
              />
            )}
            {pendingUpdate.seats !== null && (
              <DetailRow
                label="Seats"
                value={`${subscription.seats} -> ${pendingUpdate.seats}`}
              />
            )}
            <DetailRow
              label="Update in effect from"
              value={
                <FormattedDateTime
                  datetime={pendingUpdate.applies_at}
                  dateStyle="long"
                />
              }
            />
          </div>
        </div>
      )}

      {/* Cancel + pause/resume actions, gated by billing permissions */}
      {(showCancelAction || showPauseAction) && (
        <div className="flex flex-col gap-2">
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
        </div>
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

      <div className="flex w-full flex-col gap-4">
        {hasInvoices && (
          <div className="flex flex-col gap-y-4">
            <h3 className="text-lg">Invoices</h3>
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
                    <span className="dark:text-polar-500 text-sm text-gray-500">
                      {formatCurrency('compact')(
                        row.original.total_amount,
                        row.original.currency,
                      )}
                    </span>
                  ),
                },
                {
                  accessorKey: 'id',
                  header: '',
                  cell: ({ row }) => (
                    <span className="flex justify-end">
                      <DownloadInvoicePortal
                        customerSessionToken={customerSessionToken}
                        order={row.original}
                        onInvoiceGenerated={refetchOrders}
                        dropdown
                      />
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
      </div>

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
    </div>
  )
}

export default CustomerPortalSubscription
