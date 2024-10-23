'use client'

import { CustomerPortal } from '@/components/CustomerPortal/CustomerPortal'
import {
  ListResourceUserOrder,
  ListResourceUserSubscription,
  Organization,
} from '@polar-sh/sdk'

const ClientPage = ({
  organization,
  subscriptions,
  orders,
}: {
  organization: Organization
  subscriptions: ListResourceUserSubscription
  orders: ListResourceUserOrder
}) => {
  return (
    <CustomerPortal
      organization={organization}
      subscriptions={subscriptions.items ?? []}
      orders={orders.items ?? []}
    />
  )
}

export default ClientPage
