import { useOrder } from '@/hooks/queries/orders'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Status, type StatusColor } from '@polar-sh/orbit'
import Link from 'next/link'
import { useContext, useMemo } from 'react'
import { EventCardBase } from './EventCardBase'

const BillingReasonDisplayName: Record<schemas['OrderBillingReason'], string> =
  {
    purchase: 'Purchase',
    subscription_create: 'Subscription Creation',
    subscription_cycle: 'Subscription Cycle',
    subscription_update: 'Subscription Update',
    subscription_meter_cycle: 'Meter Cycle',
  }

export interface OrderEventCardProps {
  event: schemas['OrderPaidEvent'] | schemas['OrderRefundedEvent']
}

export const OrderEventCard = ({ event }: OrderEventCardProps) => {
  const { organization } = useContext(OrganizationContext)
  const { data: order, isLoading: isLoadingOrder } = useOrder(
    event.metadata.order_id,
  )

  const status = useMemo((): [string, StatusColor] | null => {
    if (!order) return null

    switch (event.name) {
      case 'order.paid':
        return ['Paid', 'green']
      case 'order.refunded':
        return [
          order.status === 'partially_refunded'
            ? 'Partially Refunded'
            : 'Refunded',
          'purple',
        ]
      default:
        return null
    }
  }, [order, event])

  const billingReason = useMemo(() => {
    if (!order) return null

    switch (event.name) {
      case 'order.paid':
        return BillingReasonDisplayName[order.billing_reason]
      default:
        return null
    }
  }, [order, event])

  const contextValue = useMemo(() => {
    if (!order) return null

    switch (event.name) {
      case 'order.paid':
        return formatCurrency('compact')(order.total_amount, order.currency)
      case 'order.refunded':
        return formatCurrency('compact')(order.refunded_amount, order.currency)
    }
  }, [order, event])

  return (
    <EventCardBase loading={isLoadingOrder}>
      {order ? (
        <Link
          href={`/dashboard/${organization.slug}/sales/${order.id}`}
          className="flex grow flex-row items-center justify-between gap-x-12"
        >
          <div className="flex flex-row items-center gap-x-4 p-2">
            <div className="flex flex-row items-center gap-x-4">
              <span className="">{order.product?.name}</span>
            </div>
            {billingReason && (
              <span className="dark:text-polar-500 text-gray-500">
                {billingReason}
              </span>
            )}
          </div>
          <div className="flex flex-row items-center gap-x-4">
            <span className="dark:text-polar-500 text-gray-500">
              {contextValue}
            </span>
            {status ? (
              <Status status={status[0]} color={status[1]} size="small" />
            ) : null}
          </div>
        </Link>
      ) : null}
    </EventCardBase>
  )
}
