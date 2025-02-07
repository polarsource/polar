'use client'

import { CustomerPortal } from '@/components/CustomerPortal/CustomerPortal'
import { components } from '@polar-sh/client'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

const ClientPage = ({
  organization,
  subscriptions,
  orders,
  customerSessionToken,
}: {
  organization: components['schemas']['Organization']
  subscriptions: components['schemas']['ListResource_CustomerSubscription_']
  orders: components['schemas']['ListResource_CustomerOrder_']
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
