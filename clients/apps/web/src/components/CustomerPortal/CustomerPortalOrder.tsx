'use client'

import { canRetryOrderPayment } from '@/utils/order'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { DownloadInvoicePortal } from '../Orders/DownloadInvoice'
import { DetailRow } from '../Shared/DetailRow'
import { CustomerPortalGrants } from './CustomerPortalGrants'
import { OrderPaymentRetryModal } from './OrderPaymentRetryModal'
import { SeatManagementTable } from './SeatManagementTable'

const OrderStatusDisplayTitle: Record<schemas['Order']['status'], string> = {
  paid: 'Paid',
  pending: 'Pending',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded',
  void: 'Void',
}

const OrderStatusDisplayColor: Record<schemas['Order']['status'], string> = {
  paid: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500',
  pending:
    'bg-yellow-100 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-500',
  refunded:
    'bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-400',
  partially_refunded:
    'bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-400',
  void: 'bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-400',
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

  const isPartiallyOrFullyRefunded = useMemo(() => {
    return order.status === 'partially_refunded' || order.status === 'refunded'
  }, [order])

  // Seats management
  const hasSeatBasedOrder = order.seats && order.seats > 0

  return (
    <div className="flex h-full flex-col gap-12">
      <div className="flex w-full flex-col gap-8">
        <div className="flex flex-row flex-wrap gap-x-4">
          <h3 className="text-2xl">{order.description}</h3>
          <Status
            status={OrderStatusDisplayTitle[order.status]}
            className={twMerge(OrderStatusDisplayColor[order.status])}
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
                        {formatCurrency('accounting')(
                          item.amount,
                          order.currency,
                        )}
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
                  {formatCurrency('accounting')(
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
                    ? formatCurrency('accounting')(
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
                  {formatCurrency('accounting')(
                    order.net_amount,
                    order.currency,
                  )}
                </span>
              }
              valueClassName="justify-end"
            />
            <DetailRow
              label="Tax"
              value={
                <span>
                  {formatCurrency('accounting')(
                    order.tax_amount,
                    order.currency,
                  )}
                </span>
              }
              valueClassName="justify-end"
            />
            <DetailRow
              label="Total"
              value={
                <span>
                  {formatCurrency('accounting')(
                    order.total_amount,
                    order.currency,
                  )}
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
                      {formatCurrency('accounting')(
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
                      {formatCurrency('accounting')(
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
                    {formatCurrency('accounting')(
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
          <SeatManagementTable api={api} identifier={{ orderId: order.id }} />
        )}

        <CustomerPortalGrants
          api={api}
          subscriptionId={order.subscription_id ?? undefined}
          orderId={order.id}
        />
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
