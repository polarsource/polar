'use client'

import { CustomerPortalOverview } from '@/components/CustomerPortal/CustomerPortalOverview'
import { schemas } from '@polar-sh/client'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

const ClientPage = ({
  organization,
  products,
  subscriptions,
  claimedSubscriptions,
  customerSessionToken,
}: {
  organization: schemas['CustomerOrganization']
  products: schemas['CustomerProduct'][]
  subscriptions: schemas['ListResource_CustomerSubscription_']
  claimedSubscriptions: schemas['CustomerSubscription'][]
  customerSessionToken: string
}) => {
  return (
    <NuqsAdapter>
      <CustomerPortalOverview
        organization={organization}
        products={products}
        subscriptions={subscriptions.items ?? []}
        claimedSubscriptions={claimedSubscriptions}
        customerSessionToken={customerSessionToken}
      />
    </NuqsAdapter>
  )
}

export default ClientPage
