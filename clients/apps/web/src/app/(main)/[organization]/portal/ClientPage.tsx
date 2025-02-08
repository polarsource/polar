'use client'

import { CustomerPortal } from '@/components/CustomerPortal/CustomerPortal'
import {
  ListResourceCustomerOrder,
  ListResourceCustomerSubscription,
  Organization,
} from '@polar-sh/api'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

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
    <NuqsAdapter>
      <CustomerPortal
        organization={organization}
        subscriptions={subscriptions.items ?? []}
        orders={orders.items ?? []}
        customerSessionToken={customerSessionToken}
      />
    </NuqsAdapter>
  )
}

export default ClientPage
