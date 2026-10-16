'use client'

import { CustomerPortalOrders } from '@/components/CustomerPortal/CustomerPortalOrders'
import { PortalPageHeader } from '@/components/CustomerPortal/PortalPrimitives'
import { schemas } from '@polar-sh/client'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

const ClientPage = ({
  organization,
  orders,
  customerSessionToken,
}: {
  organization: schemas['CustomerOrganization']
  orders: schemas['ListResource_CustomerOrder_']
  customerSessionToken: string
}) => {
  return (
    <NuqsAdapter>
      <PortalPageHeader
        title="Orders"
        description="Receipts and invoices for every purchase"
      />
      <CustomerPortalOrders
        organization={organization}
        orders={orders.items ?? []}
        customerSessionToken={customerSessionToken}
      />
    </NuqsAdapter>
  )
}

export default ClientPage
