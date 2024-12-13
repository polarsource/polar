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
  customerSessionToken,
}: {
  organization: Organization
  subscriptions: ListResourceCustomerSubscription
  orders: ListResourceCustomerOrder
  customerSessionToken?: string
}) => {
  return (
    <CustomerPortal
      organization={organization}
      subscriptions={subscriptions.items ?? []}
      orders={orders.items ?? []}
      customerSessionToken={customerSessionToken}
    />
  )
}

export default ClientPage
