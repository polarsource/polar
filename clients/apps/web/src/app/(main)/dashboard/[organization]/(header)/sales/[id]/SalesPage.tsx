'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import CustomFieldValue from '@/components/CustomFields/CustomFieldValue'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { DownloadInvoiceDashboard } from '@/components/Orders/DownloadInvoice'
import PaymentMethod from '@/components/PaymentMethod/PaymentMethod'
import PaymentStatus from '@/components/PaymentStatus/PaymentStatus'
import { ProductListItem } from '@/components/Products/ProductListItem'
import { RefundModal } from '@/components/Refunds/RefundModal'
import {
  RefundReasonDisplay,
  RefundStatusDisplayColor,
  RefundStatusDisplayTitle,
} from '@/components/Refunds/utils'
import { SeatViewOnlyTable } from '@/components/Seats/SeatViewOnlyTable'
import { DetailRow } from '@/components/Shared/DetailRow'
import { useCustomFields, useProduct } from '@/hooks/queries'
import { useDisputes } from '@/hooks/queries/disputes'
import { useOrder } from '@/hooks/queries/orders'
import { usePayments } from '@/hooks/queries/payments'
import { useRefunds } from '@/hooks/queries/refunds'
import { useOrganizationSeats } from '@/hooks/queries/seats'
import {
  DisputeStatusDisplayColor,
  DisputeStatusDisplayTitle,
} from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { List } from '@polar-sh/ui/components/atoms/List'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { Separator } from '@radix-ui/react-dropdown-menu'
import React from 'react'
import { twMerge } from 'tailwind-merge'

const OrderStatusDisplayName: Record<schemas['OrderStatus'], string> = {
  pending: 'Pending payment',
  paid: 'Paid',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded',
}

const OrderStatusDisplayColor: Record<schemas['OrderStatus'], string> = {
  pending: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-950',
  paid: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950',
  refunded: 'bg-blue-100 text-blue-400 dark:bg-blue-950',
  partially_refunded:
    'bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-400',
}

interface ClientPageProps {
  organization: schemas['Organization']
  order: schemas['Order']
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  order: _order,
}) => {
  const { data: order, refetch: refetchOrder } = useOrder(_order.id, _order)
  const { data: product } = useProduct(_order.product_id)
  const { data: customFields } = useCustomFields(organization.id)
  const { data: payments, isLoading: paymentsLoading } = usePayments(
    organization.id,
    { order_id: _order.id },
  )
  const { data: refunds, isLoading: refundsLoading } = useRefunds(_order.id)
  const { data: disputes, isLoading: disputesLoading } = useDisputes(
    organization.id,
    { order_id: _order.id },
  )

  const {
    isShown: isRefundModalShown,
    show: showRefundModal,
    hide: hideRefundModal,
  } = useModal()

  const canRefund =
    order?.paid && (order?.refunded_amount ?? 0) < (order?.net_amount ?? 0)

  // Seat management for seat-based orders (view-only)
  const hasSeatBasedOrder = !!order?.seats && order.seats > 0

  const { data: seatsData, isLoading: isLoadingSeats } = useOrganizationSeats(
    hasSeatBasedOrder ? { orderId: order?.id } : undefined,
  )

  const totalSeats = seatsData?.total_seats || 0
  const availableSeats = seatsData?.available_seats || 0
  const seats = seatsData?.seats || []

  if (!order) {
    return null
  }

  return (
    <DashboardBody
      title={
        <div className="flex flex-col gap-4">
          <div className="flex flex-row items-center gap-4">
            <h2 className="text-xl font-normal">Order</h2>
            <Status
              status={OrderStatusDisplayName[order.status]}
              className={OrderStatusDisplayColor[order.status]}
            />
          </div>
        </div>
      }
      header={
        <>
          {order.paid && (
            <DownloadInvoiceDashboard
              order={order}
              organization={organization}
              onInvoiceGenerated={refetchOrder}
            />
          )}
        </>
      }
      className="gap-y-12"
      contextView={
        <CustomerContextView
          organization={organization}
          customer={order.customer as schemas['Customer']}
        />
      }
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none md:block hidden md:shadow-none"
    >
      {product && (
        <List size="small">
          <ProductListItem organization={organization} product={product} />
        </List>
      )}
      <ShadowBox className="dark:divide-polar-700 flex flex-col divide-y divide-gray-200 border-gray-200 bg-transparent p-0 md:rounded-3xl!">
        <div className="flex flex-col gap-6 p-4 md:p-8">
          <div className="flex flex-col gap-4 md:gap-1">
            <DetailRow label="Invoice number" value={order.invoice_number} />
            <DetailRow
              label="Order ID"
              value={order.id}
              valueClassName="font-mono text-sm"
            />
            <DetailRow
              label="Order Date"
              value={
                <FormattedDateTime
                  dateStyle="medium"
                  resolution="time"
                  datetime={order.created_at}
                />
              }
            />
            <DetailRow
              label="Status"
              value={
                <Status
                  status={OrderStatusDisplayName[order.status]}
                  className={twMerge(
                    OrderStatusDisplayColor[order.status],
                    'w-fit',
                  )}
                />
              }
            />

            <DetailRow
              label="Discount Code"
              value={order.discount ? order.discount.code : '—'}
              valueClassName="font-mono capitalize"
            />

            <DetailRow
              label="Billing Reason"
              value={order.billing_reason.split('_').join(' ')}
              valueClassName="capitalize"
            />

            <Separator className="dark:bg-polar-700 my-4 h-px bg-gray-300" />

            <div className="flex flex-col gap-y-6 pb-4">
              {order.items.map((item) => (
                <DetailRow
                  key={item.id}
                  label={item.label}
                  value={formatCurrencyAndAmount(item.amount, order.currency)}
                />
              ))}
            </div>

            <DetailRow
              label="Subtotal"
              value={formatCurrencyAndAmount(
                order.subtotal_amount,
                order.currency,
              )}
            />
            <DetailRow
              label="Discount"
              value={
                order.discount_amount
                  ? formatCurrencyAndAmount(
                      -order.discount_amount,
                      order.currency,
                    )
                  : '—'
              }
            />
            <DetailRow
              label="Net amount"
              value={formatCurrencyAndAmount(order.net_amount, order.currency)}
            />
            <DetailRow
              label="Tax"
              value={formatCurrencyAndAmount(order.tax_amount, order.currency)}
            />
            <DetailRow
              label="Total"
              value={formatCurrencyAndAmount(
                order.total_amount,
                order.currency,
              )}
            />
            {order.applied_balance_amount !== 0 && (
              <>
                <DetailRow
                  label="Applied balance"
                  value={formatCurrencyAndAmount(
                    order.applied_balance_amount,
                    order.currency,
                  )}
                />
                <DetailRow
                  label="To be paid"
                  value={formatCurrencyAndAmount(
                    order.due_amount,
                    order.currency,
                  )}
                />
              </>
            )}

            {order.billing_address ? (
              <>
                <Separator className="dark:bg-polar-700 my-4 h-px bg-gray-300" />
                <DetailRow
                  label="Country"
                  value={order.billing_address?.country}
                />
                <DetailRow
                  label="Address"
                  value={order.billing_address?.line1}
                />
                <DetailRow
                  label="Address 2"
                  value={order.billing_address?.line2}
                />
                <DetailRow
                  label="Postal Code"
                  value={order.billing_address?.postal_code}
                />
                <DetailRow label="City" value={order.billing_address?.city} />
                <DetailRow label="State" value={order.billing_address?.state} />
              </>
            ) : (
              <></>
            )}
          </div>
        </div>

        {(customFields?.items?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-6 p-8">
            <h3 className="text-lg">Custom Fields</h3>
            <div className="flex flex-col gap-2">
              {customFields?.items?.map((field) => (
                <DetailRow
                  key={field.id}
                  label={field.name}
                  value={
                    <CustomFieldValue
                      field={field}
                      value={
                        order.custom_field_data
                          ? order.custom_field_data[
                              field.slug as keyof typeof order.custom_field_data
                            ]
                          : undefined
                      }
                    />
                  }
                />
              ))}
            </div>
          </div>
        )}

        {Object.keys(order.metadata).length > 0 && (
          <div className="flex flex-col gap-6 p-8">
            <h3 className="text-lg">Metadata</h3>
            <div className="flex flex-col gap-2">
              {Object.entries(order.metadata).map(([key, value]) => (
                <DetailRow key={key} label={key} value={value} />
              ))}
            </div>
          </div>
        )}
      </ShadowBox>

      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center justify-between gap-x-8">
          <div className="flex flex-row items-center justify-between gap-x-6">
            <h3 className="text-lg">Payment Attempts</h3>
          </div>
        </div>

        <DataTable
          isLoading={paymentsLoading}
          columns={[
            {
              accessorKey: 'created_at',
              header: 'Created At',
              cell: ({
                row: {
                  original: { created_at },
                },
              }) => (
                <FormattedDateTime
                  dateStyle="medium"
                  resolution="time"
                  datetime={created_at}
                />
              ),
            },
            {
              accessorKey: 'method',
              header: 'Method',
              cell: ({ row: { original } }) => (
                <PaymentMethod payment={original} />
              ),
            },
            {
              accessorKey: 'status',
              header: 'Status',
              cell: ({ row: { original } }) => (
                <PaymentStatus payment={original} />
              ),
            },
          ]}
          data={payments?.items ?? []}
        />
      </div>

      {order.paid && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-row items-center justify-between gap-x-8">
            <div className="flex flex-row items-center justify-between gap-x-6">
              <h3 className="text-lg">Refunds</h3>
            </div>
            {canRefund && (
              <Button onClick={showRefundModal}>Refund Order</Button>
            )}
          </div>

          <DataTable
            isLoading={refundsLoading}
            columns={[
              {
                accessorKey: 'created_at',
                header: 'Created At',
                cell: ({ row }) => (
                  <FormattedDateTime
                    dateStyle="long"
                    datetime={row.original.created_at}
                  />
                ),
              },
              {
                accessorKey: 'amount',
                header: 'Amount',
                cell: ({ row }) =>
                  formatCurrencyAndAmount(
                    row.original.amount,
                    row.original.currency,
                  ),
              },
              {
                accessorKey: 'status',
                header: 'Status',
                cell: ({ row }) => (
                  <Status
                    className={twMerge(
                      RefundStatusDisplayColor[row.original.status],
                      'w-fit',
                    )}
                    status={RefundStatusDisplayTitle[row.original.status]}
                  />
                ),
              },
              {
                accessorKey: 'reason',
                header: 'Reason',
                cell: ({ row }) => RefundReasonDisplay[row.original.reason],
              },
              {
                accessorKey: 'revoke_benefits',
                header: 'Revoke Benefits',
                cell: ({ row }) => (
                  <Status
                    status={row.original.revoke_benefits ? 'True' : 'False'}
                    className={twMerge(
                      'w-fit',
                      row.original.revoke_benefits
                        ? 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950'
                        : 'bg-red-100 text-red-500 dark:bg-red-950',
                    )}
                  />
                ),
              },
            ]}
            data={refunds?.items ?? []}
          />
        </div>
      )}

      {disputes && disputes.items.length > 0 && (
        <div className="flex flex-col gap-6">
          <h3 className="text-lg">Disputes</h3>

          <DataTable
            isLoading={disputesLoading}
            columns={[
              {
                accessorKey: 'created_at',
                header: 'Created At',
                cell: ({ row }) => (
                  <FormattedDateTime
                    dateStyle="long"
                    datetime={row.original.created_at}
                  />
                ),
              },
              {
                accessorKey: 'amount',
                header: 'Amount',
                cell: ({ row }) =>
                  formatCurrencyAndAmount(
                    row.original.amount,
                    row.original.currency,
                  ),
              },
              {
                accessorKey: 'status',
                header: 'Status',
                cell: ({ row }) => (
                  <Status
                    className={twMerge(
                      DisputeStatusDisplayColor[row.original.status],
                      'w-fit',
                    )}
                    status={DisputeStatusDisplayTitle[row.original.status]}
                  />
                ),
              },
            ]}
            data={disputes?.items ?? []}
          />
        </div>
      )}

      {hasSeatBasedOrder && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-lg">Seats</h3>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              {availableSeats} of {totalSeats} seats available
            </p>
          </div>

          {!isLoadingSeats && seats.length > 0 && (
            <div className="flex flex-col gap-4">
              <h4 className="text-base font-medium">Assigned Seats</h4>
              <SeatViewOnlyTable seats={seats} />
            </div>
          )}

          {!isLoadingSeats && seats.length === 0 && (
            <p className="dark:text-polar-500 text-sm text-gray-500">
              No seats have been assigned yet.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-y-6 md:hidden">
        <h3 className="text-lg">Customer</h3>
        <CustomerContextView
          organization={organization}
          customer={order.customer as schemas['Customer']}
        />
      </div>

      <InlineModal
        isShown={isRefundModalShown}
        hide={hideRefundModal}
        modalContent={<RefundModal order={order} hide={hideRefundModal} />}
      />
    </DashboardBody>
  )
}

export default ClientPage
