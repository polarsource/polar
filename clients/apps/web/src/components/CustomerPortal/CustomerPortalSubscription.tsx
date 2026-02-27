'use client'

import {
  useCustomerCancelSubscription,
  useCustomerOrders,
  usePortalAuthenticatedUser,
} from '@/hooks/queries'
import { hasBillingPermission } from '@/utils/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useModal } from '../Modal/useModal'
import { DownloadInvoicePortal } from '../Orders/DownloadInvoice'
import AmountLabel from '../Shared/AmountLabel'
import { DetailRow } from '../Shared/DetailRow'
import CustomerCancellationModal from '../Subscriptions/CustomerCancellationModal'
import { SubscriptionStatusLabel } from '../Subscriptions/utils'
import { CustomerPortalGrants } from './CustomerPortalGrants'
import { SeatManagementTable } from './SeatManagementTable'

const CustomerPortalSubscription = ({
  api,
  customerSessionToken,
  subscription,
}: {
  api: Client
  customerSessionToken: string
  subscription: schemas['CustomerSubscription']
}) => {
  const {
    show: showCancelModal,
    hide: hideCancelModal,
    isShown: cancelModalIsShown,
  } = useModal()

  // Get authenticated user to check billing permissions
  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)
  const canManageBilling = hasBillingPermission(authenticatedUser)

  const { data: orders, refetch: refetchOrders } = useCustomerOrders(api, {
    subscription_id: subscription.id,
    limit: 100,
    sorting: ['-created_at'],
  })

  const cancelSubscription = useCustomerCancelSubscription(api)

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
        {/* eslint-disable-next-line no-restricted-syntax */}
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
        {!subscription.ended_at && subscription.current_period_end && (
          <DetailRow
            label={
              subscription.cancel_at_period_end ? 'Expiry Date' : 'Renewal Date'
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

      {/* Cancel button - only shown for users with billing permissions */}
      {!isCancelled && canManageBilling && (
        <Button
          variant="secondary"
          fullWidth
          onClick={showCancelModal}
          aria-label="Cancel subscription"
        >
          Cancel Subscription
        </Button>
      )}

      {/* Seat management - only shown for users with billing permissions */}
      {hasSeatBasedPricing && showSeatManagement && canManageBilling && (
        <SeatManagementTable
          api={api}
          identifier={{ subscriptionId: subscription.id }}
        />
      )}

      <CustomerPortalGrants api={api} subscriptionId={subscription.id} />

      <div className="flex w-full flex-col gap-4">
        {hasInvoices && (
          <div className="flex flex-col gap-y-4">
            {/* eslint-disable-next-line no-restricted-syntax */}
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
                    // eslint-disable-next-line no-restricted-syntax
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
                    // eslint-disable-next-line no-restricted-syntax
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
    </div>
  )
}

export default CustomerPortalSubscription
