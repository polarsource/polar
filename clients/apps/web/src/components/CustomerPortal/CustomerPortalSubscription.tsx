'use client'

import { BenefitGrant } from '@/components/Benefit/BenefitGrant'
import {
  useAssignSeat,
  useCustomerBenefitGrants,
  useCustomerCancelSubscription,
  useCustomerOrders,
  useCustomerPaymentMethods,
  useCustomerSeats,
  usePortalAuthenticatedUser,
  useResendSeatInvitation,
  useRevokeSeat,
} from '@/hooks/queries'
import { hasBillingPermission } from '@/utils/customerPortal'
import { validateEmail } from '@/utils/validation'
import { Client, schemas } from '@polar-sh/client'
import { useCustomerPortalCustomer } from '@polar-sh/customer-portal/react'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Input from '@polar-sh/ui/components/atoms/Input'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { DownloadInvoicePortal } from '../Orders/DownloadInvoice'
import AmountLabel from '../Shared/AmountLabel'
import { DetailRow } from '../Shared/DetailRow'
import CustomerCancellationModal from '../Subscriptions/CustomerCancellationModal'
import { SubscriptionStatusLabel } from '../Subscriptions/utils'
import { toast } from '../Toast/use-toast'
import { AddPaymentMethodModal } from './AddPaymentMethodModal'
import { CustomerSeatQuantityManager } from './CustomerSeatQuantityManager'
import PaymentMethod from './PaymentMethod'
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

  const {
    isShown: isAddPaymentMethodModalOpen,
    hide: hideAddPaymentMethodModal,
    show: showAddPaymentMethodModal,
  } = useModal()

  // Theme for Stripe Elements
  const theme = useTheme()
  const organization = subscription.product.organization
  const themePreset = getThemePreset(
    organization.slug,
    theme.resolvedTheme as 'light' | 'dark',
  )

  // Get authenticated user to check billing permissions
  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)
  const canManageBilling = hasBillingPermission(authenticatedUser)

  // Get customer data for payment methods
  const { data: customer } = useCustomerPortalCustomer()
  const { data: paymentMethods } = useCustomerPaymentMethods(api)

  const { data: benefitGrants } = useCustomerBenefitGrants(api, {
    subscription_id: subscription.id,
    limit: 100,
    sorting: ['type'],
  })

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

  const { data: seatsData, isLoading: isLoadingSeats } = useCustomerSeats(
    api,
    hasSeatBasedPricing ? { subscriptionId: subscription.id } : undefined,
  )
  const assignSeat = useAssignSeat(api)
  const revokeSeat = useRevokeSeat(api)
  const resendInvitation = useResendSeatInvitation(api)

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [isSending, setIsSending] = useState(false)

  const handleAssignSeat = async () => {
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    if (!validateEmail(email)) {
      setError('Invalid email format')
      return
    }

    setIsSending(true)
    setError(undefined)

    try {
      const result = await assignSeat.mutateAsync({
        subscription_id: subscription.id,
        email,
      })

      if (result.error) {
        setError(
          typeof result.error.detail === 'string'
            ? result.error.detail
            : 'Failed to assign seat',
        )
      } else {
        setEmail('')
      }
    } catch {
      setError('Failed to send invitation')
    } finally {
      setIsSending(false)
    }
  }

  const handleRevokeSeat = async (seatId: string) => {
    try {
      await revokeSeat.mutateAsync(seatId)
      toast({
        title: 'Seat revoked successfully',
        description: 'The seat has been revoked and is now available.',
      })
    } catch (error) {
      toast({
        title: 'Failed to revoke seat',
        description:
          error instanceof Error ? error.message : 'An error occurred.',
        variant: 'error',
      })
    }
  }

  const handleResendInvitation = async (seatId: string) => {
    try {
      await resendInvitation.mutateAsync(seatId)
      toast({
        title: 'Invitation resent',
        description: 'The invitation email has been sent again.',
      })
    } catch (error) {
      toast({
        title: 'Failed to resend invitation',
        description:
          error instanceof Error ? error.message : 'An error occurred.',
        variant: 'error',
      })
    }
  }

  const totalSeats = seatsData?.total_seats || 0
  const availableSeats = seatsData?.available_seats || 0
  const seats = seatsData?.seats || []

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
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg">Seat Management</h3>
            <CustomerSeatQuantityManager
              api={api}
              subscription={subscription}
              totalSeats={totalSeats}
              assignedSeats={totalSeats - availableSeats}
            />
          </div>

          <div className="flex flex-col gap-y-2">
            <h3 className="text-lg">Invite Members</h3>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Send invitations to claim available seats
            </p>
          </div>
          <div className="flex flex-col gap-y-3">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError(undefined)
                  }}
                  disabled={isSending || availableSeats === 0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAssignSeat()
                    }
                  }}
                />
                {error && (
                  <p className="dark:text-polar-400 mt-1 text-xs text-gray-500">
                    {error}
                  </p>
                )}
              </div>
              <Button
                onClick={handleAssignSeat}
                disabled={!email.trim() || availableSeats === 0 || isSending}
                loading={isSending}
              >
                Invite
              </Button>
            </div>
          </div>

          {!isLoadingSeats && seats.length > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-lg">Assigned Seats</h3>
              <SeatManagementTable
                seats={seats}
                onRevokeSeat={handleRevokeSeat}
                onResendInvitation={handleResendInvitation}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex w-full flex-col gap-4">
        <h3 className="text-lg">Benefit Grants</h3>
        {(benefitGrants?.items.length ?? 0) > 0 ? (
          <div className="flex flex-col gap-4">
            <List>
              {benefitGrants?.items.map((benefitGrant) => (
                <ListItem
                  key={benefitGrant.id}
                  className="py-6 hover:bg-transparent dark:hover:bg-transparent"
                >
                  <BenefitGrant api={api} benefitGrant={benefitGrant} />
                </ListItem>
              ))}
            </List>
          </div>
        ) : (
          <div className="dark:border-polar-700 flex flex-col items-center justify-center gap-4 rounded-2xl border border-gray-200 p-6">
            <span className="dark:text-polar-500 text-gray-500">
              This subscription has no benefit grants
            </span>
          </div>
        )}
      </div>

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
                      {formatCurrencyAndAmount(
                        row.original.total_amount,
                        row.original.currency,
                        0,
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

      {/* Payment Methods - only shown for users with billing permissions */}
      {canManageBilling && customer && (
        <div className="flex w-full flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg">Payment Methods</h3>
            <Button variant="secondary" onClick={showAddPaymentMethodModal}>
              Add Payment Method
            </Button>
          </div>
          {paymentMethods?.items && paymentMethods.items.length > 0 ? (
            <div className="flex flex-col gap-4">
              {paymentMethods.items.map((pm) => (
                <PaymentMethod
                  key={pm.id}
                  customer={customer}
                  paymentMethod={pm}
                  api={api}
                  deletable={true}
                />
              ))}
            </div>
          ) : (
            <div className="dark:border-polar-700 flex flex-col items-center justify-center gap-4 rounded-2xl border border-gray-200 p-6">
              <span className="dark:text-polar-500 text-gray-500">
                No payment methods on file
              </span>
            </div>
          )}
        </div>
      )}

      <CustomerCancellationModal
        subscription={subscription}
        isShown={cancelModalIsShown}
        hide={hideCancelModal}
        cancelSubscription={cancelSubscription}
      />

      {customer && (
        <Modal
          title="Add Payment Method"
          isShown={isAddPaymentMethodModalOpen}
          hide={hideAddPaymentMethodModal}
          modalContent={
            <AddPaymentMethodModal
              api={api}
              onPaymentMethodAdded={hideAddPaymentMethodModal}
              hide={hideAddPaymentMethodModal}
              themePreset={themePreset}
            />
          }
        />
      )}
    </div>
  )
}

export default CustomerPortalSubscription
