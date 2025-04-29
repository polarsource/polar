'use client'

import { CustomerPortalOverview } from '@/components/CustomerPortal/CustomerPortalOverview'
import { schemas } from '@polar-sh/client'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

const ClientPage = ({
  organization,
  products,
  subscriptions,
  benefitGrants,
  customerSessionToken,
}: {
  organization: schemas['Organization']
  products: schemas['CustomerProduct'][]
  subscriptions: schemas['ListResource_CustomerSubscription_']
  benefitGrants: schemas['ListResource_CustomerBenefitGrant_']
  customerSessionToken?: string
}) => {
  return (
    <NuqsAdapter>
      <CustomerPortalOverview
        organization={organization}
        products={products}
        subscriptions={subscriptions.items ?? []}
        benefitGrants={benefitGrants.items ?? []}
        customerSessionToken={customerSessionToken}
      />
    </NuqsAdapter>
  )
}

export default ClientPage
