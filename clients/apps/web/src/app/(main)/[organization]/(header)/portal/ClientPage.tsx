'use client'

import { CustomerPortal } from '@/components/CustomerPortal/CustomerPortal'
import {
  ListResourceCustomerOrder,
  ListResourceCustomerSubscription,
  Organization,
} from '@polar-sh/sdk'

const ClientPage = ({
  organization,
  subscriptions,
  orders,
}: {
  organization: Organization
  subscriptions: ListResourceCustomerSubscription
  orders: ListResourceCustomerOrder
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
