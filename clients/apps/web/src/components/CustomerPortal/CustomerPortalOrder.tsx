'use client'

import { BenefitGrant } from '@/components/Benefit/BenefitGrant'
import {
  useAssignSeat,
  useCustomerBenefitGrants,
  useCustomerSeats,
  useResendSeatInvitation,
  useRevokeSeat,
} from '@/hooks/queries'
import { canRetryOrderPayment } from '@/utils/order'
import { validateEmail } from '@/utils/validation'
import { Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import React, { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { DownloadInvoicePortal } from '../Orders/DownloadInvoice'
import { DetailRow } from '../Shared/DetailRow'
import { toast } from '../Toast/use-toast'
import { OrderPaymentRetryModal } from './OrderPaymentRetryModal'
import { SeatManagementTable } from './SeatManagementTable'

const statusColors = {
  paid: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500',
  pending:
    'bg-yellow-100 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-500',
  refunded:
    'bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-400',
  partially_refunded:
    'bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-400',
}

const CustomerPortalOrder = ({
  api,
  order,
  customerSessionToken,
  themingPreset,
}: {
  api: Client
  order: schemas['CustomerOrder']
  customerSessionToken: string
  themingPreset: ThemingPresetProps
}) => {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  const { data: benefitGrants } = useCustomerBenefitGrants(api, {
    ...(order.subscription_id
      ? { subscription_id: order.subscription_id }
      : { order_id: order.id }),
    limit: 100,
  })

  const isPartiallyOrFullyRefunded = useMemo(() => {
    return order.status === 'partially_refunded' || order.status === 'refunded'
  }, [order])

  // Seats management
  const hasSeatBasedOrder = order.seats && order.seats > 0

  const { data: seatsData, isLoading: isLoadingSeats } = useCustomerSeats(
    api,
    hasSeatBasedOrder ? { orderId: order.id } : undefined,
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
        order_id: order.id,
        email,
      })

      if (result.error) {
        const errorMessage =
          typeof result.error.detail === 'string'
            ? result.error.detail
            : 'Failed to assign seat'
        setError(errorMessage)
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
    <div className="flex h-full flex-col gap-12">
      <div className="flex w-full flex-col gap-8">
        <div className="flex flex-row flex-wrap gap-x-4">
          <h3 className="text-2xl">{order.description}</h3>
          <Status
            status={order.status.split('_').join(' ')}
            className={twMerge(statusColors[order.status], 'capitalize')}
          />

          {/* Retry button */}
          {canRetryOrderPayment(order) && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsPaymentModalOpen(true)}
            >
              Retry payment
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-8">
          <div className="flex flex-col">
            {order.product && (
              <DetailRow
                label="Product"
                value={<span>{order.product.name}</span>}
              />
            )}
            <DetailRow label="Invoice number" value={order.invoice_number} />
            <DetailRow
              label="Date"
              value={
                <span>{new Date(order.created_at).toLocaleDateString()}</span>
              }
            />
          </div>

          {order.items.length > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-lg">Order Items</h3>
              <div className="flex flex-col gap-4">
                {order.items.map((item) => (
                  <DetailRow
                    key={item.id}
                    label={item.label}
                    value={
                      <span>
                        {formatCurrencyAndAmount(item.amount, order.currency)}
                      </span>
                    }
                    valueClassName="justify-end"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col">
            <DetailRow
              label="Subtotal"
              value={
                <span>
                  {formatCurrencyAndAmount(
                    order.subtotal_amount,
                    order.currency,
                  )}
                </span>
              }
              valueClassName="justify-end"
            />
            <DetailRow
              label="Discount"
              value={
                <span>
                  {order.discount_amount
                    ? formatCurrencyAndAmount(
                        -order.discount_amount,
                        order.currency,
                      )
                    : '—'}
                </span>
              }
              valueClassName="justify-end"
            />
            <DetailRow
              label="Net amount"
              value={
                <span>
                  {formatCurrencyAndAmount(order.net_amount, order.currency)}
                </span>
              }
              valueClassName="justify-end"
            />
            <DetailRow
              label="Tax"
              value={
                <span>
                  {formatCurrencyAndAmount(order.tax_amount, order.currency)}
                </span>
              }
              valueClassName="justify-end"
            />
            <DetailRow
              label="Total"
              value={
                <span>
                  {formatCurrencyAndAmount(order.total_amount, order.currency)}
                </span>
              }
              valueClassName="justify-end"
            />
            {order.applied_balance_amount !== 0 && (
              <>
                <DetailRow
                  label="Applied balance"
                  value={
                    <span>
                      {formatCurrencyAndAmount(
                        order.applied_balance_amount,
                        order.currency,
                      )}
                    </span>
                  }
                  valueClassName="justify-end"
                />
                <DetailRow
                  label="To be paid"
                  value={
                    <span>
                      {formatCurrencyAndAmount(
                        order.due_amount,
                        order.currency,
                      )}
                    </span>
                  }
                  valueClassName="justify-end"
                />
              </>
            )}

            {isPartiallyOrFullyRefunded && (
              <DetailRow
                label="Refunded amount"
                value={
                  <span>
                    {formatCurrencyAndAmount(
                      order.refunded_amount,
                      order.currency,
                    )}
                  </span>
                }
                valueClassName="justify-end"
              />
            )}
          </div>
          {order.paid && (
            <div className="flex flex-col gap-2">
              <DownloadInvoicePortal
                customerSessionToken={customerSessionToken}
                order={order}
                onInvoiceGenerated={() => {}}
              />
            </div>
          )}
        </div>

        {hasSeatBasedOrder && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-y-2">
              <h3 className="text-lg">Seats</h3>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                {availableSeats} of {totalSeats} seats available
              </p>
            </div>
            <div className="flex flex-col gap-y-3">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setEmail(e.target.value)
                      setError(undefined)
                    }}
                    disabled={isSending || availableSeats === 0}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
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
                This product has no benefit grants
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Payment Retry Modal */}
      <OrderPaymentRetryModal
        order={order}
        api={api}
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        themingPreset={themingPreset}
      />
    </div>
  )
}

export default CustomerPortalOrder
