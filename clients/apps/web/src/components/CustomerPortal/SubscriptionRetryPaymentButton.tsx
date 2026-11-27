'use client'

import { useCustomerOrders } from '@/hooks/queries/customerPortal'
import { canRetryOrderPayment } from '@/utils/order'
import { Client, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export const SubscriptionRetryPaymentButton = ({
  api,
  subscription,
}: {
  api: Client
  subscription: schemas['CustomerSubscription']
}) => {
  const searchParams = useSearchParams()
  const { data: orders } = useCustomerOrders(api, {
    subscription_id: subscription.id,
    limit: 10,
    sorting: ['-created_at'],
  })

  // Overdue renewals are paid oldest first
  const retryableOrder = orders?.items.findLast(canRetryOrderPayment)

  if (!retryableOrder) {
    return null
  }

  return (
    <Link
      href={`/${subscription.product.organization.slug}/portal/orders/${retryableOrder.id}/pay?${searchParams.toString()}`}
    >
      <Button>Retry payment</Button>
    </Link>
  )
}
