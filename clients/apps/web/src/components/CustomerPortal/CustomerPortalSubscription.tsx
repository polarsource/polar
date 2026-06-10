'use client'

import {
  useCustomerClearPendingSubscriptionUpdate,
  useCustomerCancelSubscription,
  useCustomerOrders,
  usePortalAuthenticatedUser,
} from '@/hooks/queries/customerPortal'
import { hasBillingPermission } from '@/utils/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Button } from '@polar-sh/orbit'
import { DataTable } from '@polar-sh/orbit'
import { useState } from 'react'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { useModal } from '../Modal/useModal'
import { DownloadInvoicePortal } from '../Orders/DownloadInvoice'
import AmountLabel from '../Shared/AmountLabel'
import { DetailRow } from '../Shared/DetailRow'
import CustomerCancellationModal from './CustomerCancellationModal'
import { SubscriptionStatusLabel } from '../Subscriptions/utils'
import { CustomerPortalGrants } from './CustomerPortalGrants'
import { usePortalTranslations } from './PortalLocaleProvider'
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
  const t = usePortalTranslations()
  const {
    show: showCancelModal,
    hide: hideCancelModal,
    isShown: cancelModalIsShown,
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

  const cancelSubscription = useCustomerCancelSubscription(api)
  const clearPendingUpdate = useCustomerClearPendingSubscriptionUpdate(api)

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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-xl">{subscription.product.name}</h3>
      </div>

      <div className="flex flex-col text-sm">
        <DetailRow
          label={t('portal.common.amount')}
          value={
            subscription.amount && subscription.currency ? (
              <AmountLabel
                amount={subscription.amount}
                currency={subscription.currency}
                interval={subscription.recurring_interval}
                intervalCount={subscription.recurring_interval_count}
              />
            ) : (
              t('portal.subscription.free')
            )
          }
        />
        <DetailRow
          label={t('portal.common.status')}
          value={<SubscriptionStatusLabel subscription={subscription} />}
        />
        {subscription.started_at && (
          <DetailRow
            label={t('portal.subscription.details.startDate')}
            value={
              <FormattedDateTime
                datetime={subscription.started_at}
                dateStyle="long"
                resolution="day"
              />
            }
          />
        )}
        {!subscription.ended_at && subscription.current_period_end && (
          <DetailRow
            label={
              subscription.cancel_at_period_end
                ? t('portal.subscription.details.expiryDate')
                : t('portal.subscription.details.renewalDate')
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
        {subscription.ended_at && (
          <DetailRow
            label={t('portal.subscription.details.expired')}
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
            <h3>{t('portal.subscription.pendingUpdate.title')}</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowClearPendingUpdateModal(true)}
              loading={clearPendingUpdate.isPending}
            >
              {t('portal.subscription.pendingUpdate.cancelScheduledChange')}
            </Button>
          </div>
          <div className="flex flex-col">
            {pendingProduct && (
              <DetailRow
                label={t('portal.subscription.pendingUpdate.newProduct')}
                value={`${subscription.product.name} -> ${pendingProduct?.name}`}
              />
            )}
            {pendingUpdate.seats !== null && (
              <DetailRow
                label={t('portal.subscription.pendingUpdate.seats')}
                value={`${subscription.seats} -> ${pendingUpdate.seats}`}
              />
            )}
            <DetailRow
              label={t('portal.subscription.pendingUpdate.effectiveFrom')}
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

      {/* Cancel button - only shown for users with billing permissions */}
      {!isCancelled && canManageBilling && (
        <Button
          variant="secondary"
          fullWidth
          onClick={showCancelModal}
          aria-label={t('portal.subscription.cancel.ariaLabel')}
        >
          {t('portal.subscription.cancel.title')}
        </Button>
      )}

      {/* Seat management - only shown for users with billing permissions */}
      {hasSeatBasedPricing && showSeatManagement && canManageBilling && (
        <SeatManagementTable
          api={api}
          identifier={{ subscriptionId: subscription.id }}
          prorationBehavior={
            subscription.product.organization.proration_behavior
          }
        />
      )}

      <CustomerPortalGrants api={api} subscriptionId={subscription.id} />

      <div className="flex w-full flex-col gap-4">
        {hasInvoices && (
          <div className="flex flex-col gap-y-4">
            <h3 className="text-lg">
              {t('portal.subscription.invoices.title')}
            </h3>
            <DataTable
              data={orders.items ?? []}
              isLoading={false}
              columns={[
                {
                  accessorKey: 'created_at',
                  header: t('portal.common.date'),
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
                  header: t('portal.common.amount'),
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
        subscription={subscription}
        isShown={cancelModalIsShown}
        hide={hideCancelModal}
        cancelSubscription={cancelSubscription}
      />

      <ConfirmModal
        isShown={showClearPendingUpdateModal}
        hide={() => setShowClearPendingUpdateModal(false)}
        title={t('portal.subscription.pendingUpdate.cancelScheduledChange')}
        description={t(
          'portal.subscription.pendingUpdate.clearConfirmDescription',
        )}
        onConfirm={async () => {
          await clearPendingUpdate.mutateAsync(subscription.id)
          refetchOrders()
        }}
      />
    </div>
  )
}

export default CustomerPortalSubscription
