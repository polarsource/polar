'use client'

import { CustomerPortalOverview } from '@/components/CustomerPortal/CustomerPortalOverview'
import { schemas } from '@polar-sh/client'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

const ClientPage = ({
  organization,
  products,
  subscriptions,
  claimedSubscriptions,
  benefitGrants,
  customerSessionToken,
}: {
  organization: schemas['CustomerOrganization']
  products: schemas['CustomerProduct'][]
  subscriptions: schemas['ListResource_CustomerSubscription_']
  claimedSubscriptions: schemas['CustomerSubscription'][]
  benefitGrants: schemas['ListResource_CustomerBenefitGrant_']
  customerSessionToken: string
}) => {
  return (
    <NuqsAdapter>
      <CustomerPortalOverview
        organization={organization}
        products={products}
        subscriptions={subscriptions.items ?? []}
        claimedSubscriptions={claimedSubscriptions}
        benefitGrants={benefitGrants.items ?? []}
        customerSessionToken={customerSessionToken}
      />
    </NuqsAdapter>
  )
}

export default ClientPage
