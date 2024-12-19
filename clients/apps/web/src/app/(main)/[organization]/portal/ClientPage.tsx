'use client'

import { CustomerPortal } from '@/components/CustomerPortal/CustomerPortal'
import {
  ListResourceCustomerOrder,
  ListResourceCustomerSubscription,
  Organization,
} from '@polar-sh/sdk'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'

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
    <ShadowBox className="flex w-full max-w-7xl flex-col items-center gap-12 md:px-32 md:py-24">
      <CustomerPortal
        organization={organization}
        subscriptions={subscriptions.items ?? []}
        orders={orders.items ?? []}
        customerSessionToken={customerSessionToken}
      />
    </ShadowBox>
  )
}

export default ClientPage
